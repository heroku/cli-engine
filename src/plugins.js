// @flow

import {type Config} from 'cli-engine-config'
import Command, {Topic} from 'cli-engine-command'
import type Output from 'cli-engine-command/lib/output'
import path from 'path'
import LinkedPlugins from './linked_plugins'
import UserPlugins from './user_plugins'
import BuiltinPlugins from './builtin_plugins'
import CorePlugins from './core_plugins'
import uniqby from 'lodash.uniqby'
import {convertFromV5, convertFlagsFromV5, type LegacyCommand} from './legacy'
import Cache, {type CachedCommand, type CachedPlugin, type CachedTopic} from './plugins_cache'

type PluginType = | "builtin" | "core" | "user" | "link"

type ParsedTopic = | {
  name?: ?string,
  topic?: ?string,
  description?: ?string,
  hidden?: ?boolean
} | Class<Topic>

type ParsedCommand = | LegacyCommand | Class<Command<*>>

export type ParsedPlugin = {
  topic?: ParsedTopic,
  topics?: ParsedTopic[],
  commands?: ParsedCommand[]
}

type PluginOptions = {
  tag?: string
}

export class Plugin {
  constructor (type: PluginType, path: string, plugins: Plugins, options: PluginOptions = {}) {
    this.config = plugins.config
    this.options = options
    this.out = plugins.out
    this.cache = plugins.cache
    this.type = type
    this.path = path
    let p = this.fetch()
    this.name = p.name
    this.version = p.version
  }

  config: Config
  options: PluginOptions
  type: PluginType
  path: string
  cache: Cache
  name: string
  version: string
  out: Output

  get commands (): CachedCommand[] {
    return this.fetch().commands
  }

  get topics (): CachedTopic[] {
    return this.fetch().topics
  }

  findCommand (cmd: string): ?Class<Command<*>> {
    let c = this.commands.find(c => c.id === cmd || (c.aliases || []).includes(cmd))
    if (!c) return
    let {topic, command} = c
    let p = this.require()
    let Command = (p.commands || [])
      .find(d => topic === d.topic && command === d.command)
    if (!Command) return
    return typeof Command === 'function' ? Command : convertFromV5((Command: any))
  }

  findTopic (name: string): ?Class<Topic> {
    let t = this.topics.find(t => t.topic === name)
    if (!t) return
    let Topic = (this.require().topics || [])
      .find(t => [t.topic, t.name].includes(name))
    if (!Topic) return
    return typeof Topic === 'function' ? Topic : this.buildTopic(t)
  }

  buildTopic (t: CachedTopic): Class<Topic> {
    return class extends Topic {
      static topic = t.topic
      static description = t.description
      static hidden = t.hidden
    }
  }

  fetch (): CachedPlugin {
    let c = this.cache.plugin(this.path)
    if (c) return c
    try {
      this.out.debug('updating cache for ' + this.path)
      return this.updatePlugin(this.require())
    } catch (err) {
      if (this.type === 'builtin') throw err
      this.out.warn(err)
      return {
        name: this.path,
        path: this.path,
        version: '',
        commands: [],
        topics: []
      }
    }
  }

  updatePlugin (plugin: ParsedPlugin): CachedPlugin {
    if (!plugin.commands) throw new Error('no commands found')
    const commands: CachedCommand[] = plugin.commands
    .map(c => ({
      id: c.command ? `${c.topic}:${c.command}` : c.topic,
      topic: c.topic,
      command: c.command,
      description: c.description,
      args: c.args,
      variableArgs: c.variableArgs,
      help: c.help,
      usage: c.usage,
      hidden: !!c.hidden,
      aliases: c.aliases,
      flags: convertFlagsFromV5(c.flags)
    }))
    const topics: CachedTopic[] = (plugin.topics || (plugin.topic ? [plugin.topic] : []))
    .map(t => ({
      topic: t.topic || t.name || '',
      description: t.description,
      hidden: !!t.hidden
    }))

    for (let command of commands) {
      if (topics.find(t => t.topic === command.topic)) continue
      topics.push({
        topic: command.topic,
        hidden: true
      })
    }

    const {name, version} = this.pjson()
    const cachedPlugin: CachedPlugin = {name, path: this.path, version, commands, topics}
    this.cache.updatePlugin(this.path, cachedPlugin)
    return cachedPlugin
  }

  undefaultTopic (t: (ParsedTopic | {default: ParsedTopic})): ParsedTopic {
    if (t.default) return (t.default: any)
    return t
  }

  undefaultCommand (c: (ParsedCommand | {default: ParsedCommand})): ParsedCommand {
    if (c.default && typeof c.default !== 'boolean') return (c.default: any)
    return (c: any)
  }

  require (): ParsedPlugin {
    // flow$ignore
    let required = require(this.path)
    return {
      topic: required.topic && this.undefaultTopic(required.topic),
      topics: required.topics && required.topics.map(this.undefaultTopic),
      commands: required.commands && required.commands.map(this.undefaultCommand)
    }
  }

  pjson (): {name: string, version: string} {
    if (this.type === 'builtin') {
      return {name: 'builtin', version: this.config.version}
    }

    // flow$ignore
    return require(path.join(this.path, 'package.json'))
  }
}

export default class Plugins {
  constructor (output: Output) {
    this.out = output
    this.config = output.config
    this.cache = new Cache(output)

    this.builtinPlugins = new BuiltinPlugins(this)
    this.linkedPlugins = new LinkedPlugins(this)
    this.userPlugins = new UserPlugins(this)
    this.corePlugins = new CorePlugins(this)

    this.plugins = this.builtinPlugins.list
    .concat(this.linkedPlugins.list)
    .concat(this.userPlugins.list)
    .concat(this.corePlugins.list)
    this.cache.save()
  }

  builtinPlugins: BuiltinPlugins
  linkedPlugins: LinkedPlugins
  userPlugins: UserPlugins
  corePlugins: CorePlugins
  plugins: Plugin[]
  cache: Cache
  out: Output

  get commands (): CachedCommand[] {
    let commands = []
    for (let plugin of this.plugins) {
      try {
        commands = commands.concat(plugin.commands)
      } catch (err) {
        this.out.warn(err, `error reading plugin ${plugin.name}`)
      }
    }
    return commands
  }

  list () {
    return this.plugins
  }

  isPluginInstalled (name: string): boolean {
    return !!this.plugins.find(p => p.name === name)
  }

  findCommand (cmd: string): ?Class<Command<*>> {
    for (let plugin of this.plugins) {
      let c = plugin.findCommand(cmd)
      if (c) return c
    }
  }

  commandsForTopic (topic: string): Class<Command<*>>[] {
    let commands = this.plugins.reduce((t, p) => {
      try {
        return t.concat(p.commands
          .filter(c => c.topic === topic)
          .map(c => (p.findCommand(c.id): any)))
      } catch (err) {
        this.out.warn(err, `error reading plugin ${p.name}`)
        return t
      }
    }, [])
    return uniqby(commands, 'id')
  }

  findTopic (cmd: string): ?Class<Topic> {
    let name = cmd.split(':')[0]
    for (let plugin of this.plugins) {
      let t = plugin.findTopic(name)
      if (t) return t
    }
  }

  async install (name: string, tag: string = 'latest') {
    if (this.plugins.find(p => p.name === name && p.options.tag === tag)) throw new Error(`Plugin ${name} is already installed`)
    await this.userPlugins.install(name, tag)
    this.clearCache(name)
  }

  async update () {
    await this.userPlugins.update()
    this.clearCache(...this.userPlugins.list.map(p => p.name))
  }

  async uninstall (name: string) {
    let plugin = this.plugins.filter(p => ['user', 'link'].includes(p.type)).find(p => p.name === name)
    if (!plugin) throw new Error(`${name} is not installed`)
    switch (plugin.type) {
      case 'user': {
        if (!this.config.debug) this.out.action.start(`Uninstalling plugin ${name}`)
        await this.userPlugins.remove(name)
        break
      }
      case 'link': {
        if (!this.config.debug) this.out.action.start(`Unlinking plugin ${name}`)
        this.linkedPlugins.remove(plugin.path)
        break
      }
    }
    this.clearCache(name)
    this.out.action.stop()
  }

  addPackageToPJSON (name: string, version: string = '*') {
    this.userPlugins.addPackageToPJSON(name, version)
  }

  async addLinkedPlugin (p: string) {
    await this.linkedPlugins.add(p)
  }

  async refreshLinkedPlugins () {
    await this.linkedPlugins.refresh()
  }

  clearCache (...names: string[]) {
    this.cache.deletePlugin(...names)
  }

  get topics (): CachedTopic[] {
    return uniqby(this.plugins.reduce((t, p) => t.concat(p.topics), []), 'topic')
  }

  config: Config
}
