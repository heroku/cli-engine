// @flow

import {type Config} from 'cli-engine-config'
import Command, {Topic} from 'cli-engine-command'
import type Output from 'cli-engine-command/lib/output'
import path from 'path'
import Yarn from './yarn'
import lock from 'rwlockfile'
import LinkedPlugins from './linked_plugins'
import uniqby from 'lodash.uniqby'
import {convertFromV5, convertFlagsFromV5, type LegacyCommand} from './legacy'
import fs from 'fs-extra'
import Cache, {type CachedCommand, type CachedPlugin, type CachedTopic} from './plugins_cache'

type PluginType = | "builtin" | "core" | "user" | "link"

type ParsedTopic = | {
  name?: ?string,
  topic?: ?string,
  description?: ?string,
  hidden?: ?boolean
} | Class<Topic>

type ParsedCommand = | LegacyCommand | Class<Command<*>>

type ParsedPlugin = {
  topic?: ParsedTopic,
  topics?: ParsedTopic[],
  commands?: ParsedCommand[]
}

type PJSON = {
  dependencies?: { [name: string]: string }
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
    const name = this.type === 'builtin' ? 'builtin' : this.pjson().name
    const version = this.type === 'builtin' ? this.config.version : this.pjson().version
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

  // flow$ignore
  pjson (): {name: string, version: string} { return require(path.join(this.path, 'package.json')) }
}

export default class Plugins {
  constructor (output: Output) {
    this.out = output
    this.config = output.config
    this.yarn = new Yarn(output)
    this.cache = new Cache(output)
    this.linkedPlugins = new LinkedPlugins(this)

    let commandsPath = path.resolve(path.join(__dirname, 'commands'))
    this.plugins = [new Plugin('builtin', commandsPath, this)]
    .concat(this.linkedPlugins.list())
    .concat(this.userPlugins)
    .concat(this.corePlugins)
    this.cache.save()
  }

  linkedPlugins: LinkedPlugins
  plugins: Plugin[]
  cache: Cache
  yarn: Yarn
  out: Output

  get corePlugins (): Plugin[] {
    let cli = this.config.pjson['cli-engine']
    if (!cli) return []
    return (cli.plugins || []).map(name => {
      return new Plugin('core', path.join(this.config.root, 'node_modules', name), this)
    })
  }

  get userPlugins (): Plugin[] {
    const pjson = this.userPluginsPJSON
    return entries(pjson.dependencies || {}).map(([name, tag]) => {
      return new Plugin('user', this.userPluginPath(name), this, {tag})
    })
  }

  get userPluginsPJSON (): PJSON {
    try {
      return fs.readJSONSync(this.userPluginsPJSONPath)
    } catch (err) {
      return { dependencies: {} }
    }
  }

  saveUserPluginsPJSON (pjson: PJSON) {
    fs.writeJSONSync(path.join(this.userPluginsPJSONPath), pjson)
  }

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

  async setupUserPlugins () {
    const pjson = path.join(this.userPluginsDir, 'package.json')
    const yarnrc = path.join(this.userPluginsDir, '.yarnrc')
    fs.mkdirpSync(this.userPluginsDir)
    if (!fs.existsSync(pjson)) fs.writeFileSync(pjson, JSON.stringify({private: true}))
    if (!fs.existsSync(yarnrc)) fs.writeFileSync(yarnrc, 'registry "https://cli-npm.heroku.com/"')
    await this.yarn.exec()
  }

  async install (name: string, tag: string = 'latest') {
    let unlock = await lock.write(this.lockfile, {skipOwnPid: true})
    await this.setupUserPlugins()
    if (this.plugins.find(p => p.name === name && p.options.tag === tag)) throw new Error(`Plugin ${name} is already installed`)
    this.addPackageToPJSON(name, tag)
    await this.yarn.exec()
    this.clearCache(name)
    try {
      // flow$ignore
      let plugin = (require(this.userPluginPath(name)): ParsedPlugin)
      if (!plugin.commands) throw new Error(`${name} does not appear to be a Heroku CLI plugin`)
    } catch (err) {
      await unlock()
      this.out.error(err, false)
      this.removePackageFromPJSON(name)
      this.out.exit(1)
    }
    await unlock()
  }

  async update () {
    await this.yarn.exec(['upgrade'])
    this.clearCache(...this.userPlugins.map(p => p.name))
  }

  async uninstall (name: string, forceSilently: boolean = false) {
    let unlock = await lock.write(this.lockfile, {skipOwnPid: true})
    let plugin = this.plugins.filter(p => !['core', 'builtin'].includes(p.type)).find(p => p.name === name)
    if (!plugin && forceSilently) {
      await this.yarn.exec(['remove', name])
      this.clearCache(name)
      await unlock()
      this.out.action.stop()
      return
    }
    if (!plugin) throw new Error(`${name} is not installed`)
    switch (plugin.type) {
      case 'user': {
        if (!this.config.debug) this.out.action.start(`Uninstalling plugin ${name}`)
        await this.yarn.exec(['remove', name])
        break
      }
      case 'link': {
        if (!this.config.debug) this.out.action.start(`Unlinking plugin ${name}`)
        this.linkedPlugins.remove(plugin.path)
        break
      }
    }
    this.clearCache(name)
    await unlock()
    this.out.action.stop()
  }

  addPackageToPJSON (name: string, version: string = '*') {
    let pjson = this.userPluginsPJSON
    if (!pjson.dependencies) pjson.dependencies = {}
    pjson.dependencies[name] = version
    this.saveUserPluginsPJSON(pjson)
  }

  removePackageFromPJSON (name: string) {
    let pjson = this.userPluginsPJSON
    if (!pjson.dependencies) pjson.dependencies = {}
    delete pjson.dependencies[name]
    this.saveUserPluginsPJSON(pjson)
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

  get userPluginsDir (): string { return path.join(this.config.dataDir, 'plugins') }
  get userPluginsPJSONPath (): string { return path.join(this.userPluginsDir, 'package.json') }
  userPluginPath (name: string): string { return path.join(this.userPluginsDir, 'node_modules', name) }

  get topics (): CachedTopic[] {
    return uniqby(this.plugins.reduce((t, p) => t.concat(p.topics), []), 'topic')
  }

  get lockfile (): string { return path.join(this.config.cacheDir, 'plugins.lock') }

  config: Config
}

const entries = <T> (o: {[k: string]: T}): [string, T][] => Object.keys(o).map(k => [k, o[k]])
