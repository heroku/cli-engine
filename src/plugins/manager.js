// @flow

import type {Config, Arg, Flag} from 'cli-engine-config'
import {Command} from 'cli-engine-command'
import type Cache, {CachedPlugin, CachedCommand, CachedTopic} from './cache'
import {convertFlagsFromV5, type LegacyFlag} from './legacy'
import path from 'path'
import {CLI} from 'cli-ux'
import {Hooks} from '../hooks'
import Help from 'cli-engine-command/lib/help'
import CommandHelp from '@oclif/plugin-help'
import fs from 'fs-extra'

export type PluginType = | "builtin" | "core" | "user" | "link"

const debug = require('debug')('cli-engine:plugins:manager')

type ParsedTopic = {
  id: string,
  name?: ?string,
  topic?: ?string,
  description?: ?string,
  hidden?: ?boolean
}

type ParsedCommand = {
  id: string,
  topic: string,
  command?: string,
  aliases?: string[],
  variableArgs?: boolean,
  args: Arg[],
  flags: (LegacyFlag[] | {[name: string]: Flag}),
  description?: ?string,
  help?: ?string,
  usage?: ?string,
  hidden?: ?boolean
}

type ParsedPlugin = {
  topics: ?ParsedTopic[],
  commands: ?ParsedCommand[]
}

type PluginPathOptions = {
  config: Config,
  type: PluginType,
  path: string,
  tag?: string
}

function makeID (o: any): string {
  return o.id || [(o.topic || o.name), o.command].filter(s => s).join(':')
}

function buildHelp (c: ParsedCommand, config: Config): string {
  if (!c.id) c.id = makeID(c)
  c.flags = convertFlagsFromV5(c.flags)
  if ((c: any).buildHelp) return (c: any).buildHelp(config)
  const help = new Help(config)
  return help.command((c: any))
}

function buildHelpOCLIF (c: ParsedCommand, config: Config): string {
  const help = new CommandHelp(config)
  return help.command(c)
}

function buildHelpLine (c: ParsedCommand, config: Config): [string, ?string] {
  if (!c.id) c.id = makeID(c)
  c.flags = convertFlagsFromV5(c.flags)
  if ((c: any).buildHelpLine) return (c: any).buildHelpLine(config)
  const help = new Help(config)
  return help.commandLine((c: any))
}

export class PluginPath {
  constructor (options: PluginPathOptions) {
    this.config = options.config
    this.path = options.path
    this.type = options.type
    this.tag = options.tag
    this.cli = new CLI({mock: this.config.mock})
  }

  cli: CLI
  config: Config
  path: string
  type: PluginType
  tag: string | void

  async convertToCached (): Promise<CachedPlugin> {
    let plugin: ParsedPlugin = await this.require()

    const getAliases = (c: ParsedCommand) => {
      let aliases = c.aliases || []
      if (c.default) {
        this.cli.warn(`default setting on ${c.topic} is deprecated`)
        aliases.push(c.topic)
      }
      return aliases
    }

    if (!plugin.commands) throw new Error('no commands found')

    const commands: CachedCommand[] = plugin.commands
      .map((c: ParsedCommand): CachedCommand => ({
        id: c.id || makeID(c),
        topic: c.topic,
        command: c.command,
        description: c.description,
        args: c.args,
        variableArgs: c.variableArgs,
        help: c.help,
        usage: c.usage,
        hidden: !!c.hidden,
        aliases: getAliases(c),
        buildHelpLine: buildHelpLine(c, this.config),
        buildHelp: buildHelp(c, this.config),
        flags: convertFlagsFromV5(c.flags)
      }))

    const topics: CachedTopic[] = (plugin.topics || [])
      .map((t: ParsedTopic): CachedTopic => ({
        id: t.id || '',
        topic: t.topic || '',
        description: t.description,
        hidden: !!t.hidden
      }))

    for (let command of commands) {
      if (topics.find(t => t.id === command.topic)) continue
      let topic : CachedTopic = {
        id: command.topic,
        topic: command.topic,
        hidden: true
      }
      topics.push(topic)
    }

    const {name, version} = this.pjson()
    return {name, path: this.path, version, commands, topics}
  }

  undefaultTopic (t: (ParsedTopic | {default: ParsedTopic})): ParsedTopic {
    if (t.default) t = (t.default: any)
    // normalize v5 exported topic
    if (!t.topic) t.topic = t.name || ''
    if (!t.id) t.id = t.topic
    return t
  }

  undefaultCommand (c: (ParsedCommand | {default: ParsedCommand})): ParsedCommand {
    if (c.default && typeof c.default !== 'boolean') return (c.default: any)
    return (c: any)
  }

  async require (): Promise<ParsedPlugin> {
    if (await fs.pathExists(path.join(this.path, '.oclif.manifest.json')) || await fs.pathExists(path.join(this.path, 'oclif.manifest.json'))) return this.requireOCLIF()
    let required
    try {
      required = require(this.path)
    } catch (err) {
      if (await this.repair(err)) return this.require()
      else throw err
    }
    const hooks = new Hooks({ config: this.config })
    await hooks.run('plugins:parse', {module: required})

    const exportedTopic: ParsedTopic = required.topic && this.undefaultTopic(required.topic)
    const exportedTopics : Array<ParsedTopic> = required.topics && required.topics.map(t => this.undefaultTopic(t))
    const topics: Array<ParsedTopic> = this.parsePjsonTopics().concat(exportedTopics || []).concat(exportedTopic || [])
    const commands : Array<ParsedCommand> = required.commands && required.commands.map(t => this.undefaultCommand(t))
    return {topics, commands}
  }

  parsePjsonTopics () {
    // flow$ignore
    const topics = (this.pjson()['cli-engine'] || {}).topics
    return this.transformPjsonTopics(topics)
  }

  transformPjsonTopics (topics: any, prefix: ?string) {
    const flatten = require('lodash.flatten')
    return flatten(this._transformPjsonTopics(topics))
  }

  _transformPjsonTopics (topics: any, prefix: ?string) {
    if (!topics) return []
    return Object.keys(topics || {}).map(k => {
      let t = topics[k]
      let id = prefix ? `${prefix}:${k}` : k
      let topic = Object.assign(t, {id, topic: id})
      if (t.subtopics) {
        return [topic].concat(this._transformPjsonTopics(t.subtopics, topic.id))
      }
      return topic
    })
  }

  pjson (): {name: string, version: string} {
    if (this.type === 'builtin') {
      return {name: 'builtin', version: this.config.version}
    }

    return require(path.join(this.path, 'package.json'))
  }

  async repair (err: Error): Promise<boolean> {
    debug(err)
    return false
  }

  async requireOCLIF (): any {
    let p = this.path
    let manifest;
    try { manifest = fs.readJSONSync(path.join(p, '.oclif.manifest.json')) }
    catch(e) { manifest = fs.readJSONSync(path.join(p, 'oclif.manifest.json')) }
    let Config = require('@oclif/config')
    let config = await Config.load()
    await config.loadPlugins(p, this.type, [{root: p}], {must: true})
    let topics = config.topics.map(t => ({id: t.name, ...t}))
    let commands = Object.entries(manifest.commands).map(([id, c]: [string, any]) => {
      return class extends Command<*> {
        static get id () { return id }
        static topic = id.split(':').slice(0, -1).join(':')
        static command = id.split(':').pop()
        static description = c.description
        static variableArgs = true
        static buildHelp = conf => buildHelpOCLIF(c, conf)
        async run () {
          return config.runCommand(id, process.argv.slice(3))
        }
      }
    })
    return {topics, commands}
  }
}

export class Manager {
  cli: CLI
  config: Config
  cache: Cache

  constructor ({config, cache}: {config: Config, cache: Cache}) {
    this.config = config
    this.cache = cache
    this.cli = new CLI({mock: config.mock})
  }

  async list (): Promise<PluginPath[]> {
    throw new Error('abstract method Manager.list')
  }

  async handleNodeVersionChange () {
    // user and linked will override
  }
}
