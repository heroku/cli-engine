// @flow

import {type Config} from 'cli-engine-config'
import type Output from 'cli-engine-command/lib/output'
import type {Arg} from 'cli-engine-command/lib/arg'
import type {Flag} from 'cli-engine-command/lib/flags'
import type Cache, {CachedPlugin, CachedCommand, CachedTopic} from './cache'
import {convertFlagsFromV5, type LegacyFlag} from './legacy'
import Namespaces from '../namespaces'
import path from 'path'

export type PluginType = | "builtin" | "core" | "user" | "link"

const debug = require('debug')('cli-engine:plugins:manager')

type ParsedTopic = {
  id: string,
  namespace?: ?string,
  name?: ?string,
  topic?: ?string,
  description?: ?string,
  hidden?: ?boolean
}

type ParsedCommand = {
  id: string,
  namespace?: ?string,
  topic: string,
  command?: string,
  aliases?: string[],
  variableArgs?: boolean,
  args: Arg[],
  flags: (LegacyFlag[] | {[name: string]: Flag<*>}),
  description?: ?string,
  help?: ?string,
  usage?: ?string,
  hidden?: ?boolean
}

type ParsedPlugin = {
  topic: ?ParsedTopic,
  topics: ?ParsedTopic[],
  commands: ?ParsedCommand[],
  namespace: ?string
}

type PluginPathOptions = {
  output: Output,
  type: PluginType,
  path: string,
  tag?: string
}

function makeID (o: any): string {
  return [o.namespace, (o.topic || o.name), o.command].filter(s => s).join(':')
}

export class PluginPath {
  constructor (options: PluginPathOptions) {
    this.out = options.output
    this.path = options.path
    this.type = options.type
    this.tag = options.tag

    this.config = this.out.config
  }

  out: Output
  config: Config
  path: string
  type: PluginType
  tag: string | void

  async convertToCached (): Promise<CachedPlugin> {
    let plugin: ParsedPlugin = await this.require()

    const getAliases = (c: ParsedCommand) => {
      let aliases = c.aliases || []
      if (c.default) {
        this.out.warn(`default setting on ${c.topic} is deprecated`)
        aliases.push(c.topic)
      }
      return aliases
    }

    if (!plugin.commands) throw new Error('no commands found')

    const commands: CachedCommand[] = plugin.commands
      .map((c: ParsedCommand): CachedCommand => ({
        id: c.id,
        namespace: c.namespace,
        topic: c.topic,
        command: c.command,
        description: c.description,
        args: c.args,
        variableArgs: c.variableArgs,
        help: c.help,
        usage: c.usage,
        hidden: !!c.hidden,
        aliases: getAliases(c),
        flags: convertFlagsFromV5(c.flags)
      }))
    const topics: CachedTopic[] = (plugin.topics || (plugin.topic ? [plugin.topic] : []))
      .map((t: ParsedTopic): CachedTopic => ({
        id: t.id,
        namespace: t.namespace,
        topic: t.topic || t.name || '',
        description: t.description,
        hidden: !!t.hidden
      }))

    for (let command of commands) {
      if (topics.find(t => t.topic === command.topic)) continue
      let topic : CachedTopic = {
        id: command.id,
        namespace: command.namespace,
        topic: command.topic,
        hidden: true
      }
      topics.push(topic)
    }

    const {name, version} = this.pjson()
    return {name, path: this.path, version, namespace: plugin.namespace, commands, topics}
  }

  undefaultTopic (t: (ParsedTopic | {default: ParsedTopic})): ParsedTopic {
    if (t.default) return (t.default: any)
    return t
  }

  undefaultCommand (c: (ParsedCommand | {default: ParsedCommand})): ParsedCommand {
    if (c.default && typeof c.default !== 'boolean') return (c.default: any)
    return (c: any)
  }

  addNamespace (p: ParsedCommand | ParsedTopic, namespace: ?string): ParsedCommand | ParsedTopic {
    p.namespace = namespace
    if (!p.id) p.id = makeID(p)
    return p
  }

  addNamespaceToTopic (t: ParsedTopic, namespace: ?string): ParsedTopic {
    t.namespace = namespace
    if (!t.id) t.id = makeID(t)
    return t
  }

  async require (): Promise<ParsedPlugin> {
    let required
    try {
      required = require(this.path)
    } catch (err) {
      if (await this.repair(err)) return this.require()
      else throw err
    }

    let namespace
    if (required.type !== 'builtin' || !/(\\|\/)(src|lib)(\\|\/)commands$/.test(this.path)) {
      const nsMeta = Namespaces.metaData(this.path, this.config)
      namespace = nsMeta.namespace
    }

    let topic: ParsedTopic = required.topic && this.addNamespaceToTopic(this.undefaultTopic(required.topic), namespace)
    const topics : Array<ParsedTopic> = required.topics && required.topics.map(t => this.addNamespace(this.undefaultTopic(t), namespace))
    const commands : Array<ParsedCommand> = required.commands && required.commands.map(t => this.addNamespace(this.undefaultCommand(t), namespace))
    return {topic, topics, commands, namespace}
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
}

export class Manager {
  out: Output
  config: Config
  cache: Cache

  constructor ({out, config, cache}: {out: Output, config: Config, cache: Cache}) {
    this.out = out
    this.config = config
    this.cache = cache
  }

  async list (): Promise<PluginPath[]> {
    throw new Error('abstract method Manager.list')
  }

  async handleNodeVersionChange () {
    // user and linked will override
  }
}
