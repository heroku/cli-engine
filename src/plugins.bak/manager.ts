import {IFlag, IArg} from 'cli-flags'
import {Config, Topic} from 'cli-engine-config'
import {Cache, CachedPlugin, CachedCommand} from './cache'
import {convertFlagsFromV5, LegacyFlag} from './legacy'
import * as path from 'path'
import {CLI} from 'cli-ux'

export type PluginType = | "core" | "user" | "link"

const debug = require('debug')('cli-engine:plugins:manager')

type ParsedCommand = {
  id: string,
  topic?: string,
  command?: string,
  aliases?: string[],
  variableArgs?: boolean,
  args: IArg[],
  flags: (LegacyFlag[] | {[name: string]: IFlag<any>}),
  description?: string,
  help?: string,
  usage?: string,
  hidden?: boolean
}

type ParsedPlugin = {
  topics: Topic[],
  commands: ParsedCommand[]
}

type PluginPathOptions = {
  config: Config,
  type: PluginType,
  path: string,
  tag?: string
}

export class PluginPath {
  constructor (options: PluginPathOptions) {
    this.config = options.config
    this.path = options.path
    this.type = options.type
    this.tag = options.tag
    this.cli = new CLI({mock: this.config.mock, debug: !!this.config.debug, errlog: this.config.errlog})
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
      return aliases
    }

    if (!plugin.commands) throw new Error('no commands found')

    const commands: CachedCommand[] = plugin.commands
      .map((c: ParsedCommand): CachedCommand => ({
        id: this.makeID(c),
        description: c.description,
        args: c.args,
        // variableArgs: c.variableArgs,
        help: c.help,
        usage: c.usage,
        hidden: !!c.hidden,
        aliases: getAliases(c),
        flags: convertFlagsFromV5(c.flags)
      }))

    const {name, version} = this.pjson()
    return {name, path: this.path, version, commands, topics: plugin.topics}
  }

  undefaultTopic (t: any): Topic {
    if (t.default) t = (t).default
    // normalize v5 exported topic
    t.name = t.name || t.topic || t.id
    return t
  }

  undefaultCommand (c: any): ParsedCommand {
    if (c.default && typeof c.default !== 'boolean') return c.default
    return c
  }

  async require (): Promise<ParsedPlugin> {
    let required
    try {
      required = require(this.path)
    } catch (err) {
      if (await this.repair(err)) return this.require()
      else throw err
    }

    const exportedTopic: Topic = required.topic && this.undefaultTopic(required.topic)
    const exportedTopics: Array<Topic> = required.topics && required.topics.map((t: any) => this.undefaultTopic(t))
    // const topics: Array<Topic> = this.parsePjsonTopics().concat(exportedTopics || []).concat(exportedTopic || [])
    const topics: Array<Topic> = (exportedTopics || []).concat(exportedTopic || [])
    const commands: Array<ParsedCommand> = required.commands && required.commands.map((t: any) => this.undefaultCommand(t))
    return {topics, commands}
  }

  // parsePjsonTopics () {
  //   const topics = (this.pjson()['cli-engine'] || {}).topics
  //   return this.transformPjsonTopics(topics)
  // }

  // transformPjsonTopics (topics: any, prefix: ?string) {
  //   const flatten = require('lodash.flatten')
  //   return flatten(this._transformPjsonTopics(topics))
  // }

  // _transformPjsonTopics (topics: any, prefix: ?string): ParsedTopic[] {
  //   if (!topics) return []
  //   return Object.keys(topics || {}).map(k => {
  //     let t = topics[k]
  //     let id = prefix ? `${prefix}:${k}` : k
  //     let topic = Object.assign(t, {id, topic: id})
  //     if (t.subtopics) {
  //       return [topic].concat(this._transformPjsonTopics(t.subtopics, topic.id))
  //     }
  //     return topic
  //   })
  // }

  makeID (o: any): string {
    return o.id || [(o.topic || o.name), o.command].filter(s => s).join(':')
  }

  pjson (): {name: string, version: string} {
    return require(path.join(this.path, 'package.json'))
  }

  async repair (err: Error): Promise<boolean> {
    debug(err)
    return false
  }
}

export abstract class Manager {
  cli: CLI
  config: Config
  cache: Cache

  constructor ({config, cache, cli}: {config: Config, cache: Cache, cli: CLI}) {
    this.config = config
    this.cache = cache
    this.cli = cli
  }

  abstract list(): Promise<PluginPath[]>

  async handleNodeVersionChange () {
    // user and linked will override
  }
}
