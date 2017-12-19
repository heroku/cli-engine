import deps from '../deps'
import { color } from 'heroku-cli-color'
import cli from 'cli-ux'
import { Config, ICommand } from 'cli-engine-config'
import { inspect } from 'util'
import { PluginManifest } from './manifest'
import { PluginCache } from './cache'
import { Topic, Topics, Commands, CommandInfo } from './topic'

export type Aliases = { [from: string]: string[] }

export interface PluginManagerOptions {
  config: Config
  cache?: PluginCache
  manifest?: PluginManifest
}

export abstract class PluginManager {
  protected submanagers: PluginManager[] = []
  protected config: Config
  protected manifest: PluginManifest
  protected cache: PluginCache
  protected cacheKey?: string

  constructor(opts: PluginManagerOptions) {
    this.config = opts.config
    this.manifest = opts.manifest || new deps.PluginManifest(this.config)
    this.cache = opts.cache || new deps.PluginCache(this.config)
  }

  private _initPromise: Promise<void>
  public init(): Promise<void> {
    if (this._initPromise) return this._initPromise
    return (this._initPromise = (async () => {
      await this._init()
      await this.initSubmanagers()
    })())
  }

  public async topics(): Promise<Topics> {
    await this.init()
    const fetch = async () => {
      const topics = await Topic.mergeSubtopics(
        await this._topics(),
        ...this.submanagers.map(async m => {
          try {
            return await m.topics()
          } catch (err) {
            cli.warn(err)
          }
        }),
      )
      await this.addCommandsToTopics(topics)
      return topics
    }
    if (this.cacheKey) {
      return this.cache.fetch(this.cacheKey, 'topics', fetch)
    } else {
      return fetch()
    }
  }

  public async rootCommands(): Promise<Commands> {
    await this.init()
    const fetch = async () => {
      const errHandle = (err: Error) => cli.warn(err, { context: `commandIDs: ${this.constructor.name}` })
      const promises = this.submanagers.map(s => s.rootCommands().catch(errHandle))
      let commands: Commands = await this._rootCommands()
      for (let p of promises) {
        let c = await p
        commands = { ...c, ...commands }
      }
      return commands
    }
    if (this.cacheKey) {
      return this.cache.fetch(this.cacheKey, 'root_commands', fetch)
    } else {
      return fetch()
    }
  }

  protected async _rootCommands(): Promise<Commands> {
    const commands: Commands = {}
    for (let command of await this._commandIDs()) {
      const topicID = Topic.parentTopicIDof(command)
      if (topicID) continue
      const info = await this.findCommandInfo(command)
      commands[command] = info
    }
    return commands
  }

  public async findTopic(name: string): Promise<Topic | undefined> {
    const topics = await this.topics()
    return topics[name]
  }

  public async topicIDs(): Promise<string[]> {
    return Object.keys(await this.topics())
  }

  public commandIDs(): Promise<string[]> {
    const fetch = async () => {
      await this.init()
      const errHandle = (err: Error) => cli.warn(err, { context: `commandIDs: ${this.constructor.name}` })
      const p = this.submanagers.map(s => s.commandIDs().catch(errHandle))
      const ids = await deps.util.concatPromiseArrays([this._commandIDs(), ...p])
      ids.sort()
      return ids
    }
    if (this.cacheKey) {
      return this.cache.fetch(this.cacheKey, 'command:ids', fetch)
    } else {
      return fetch()
    }
  }

  public async aliases(): Promise<Aliases> {
    await this.init()
    let aliases: Aliases = await this._aliases()
    let promises = this.submanagers.map(m => m.aliases())
    for (let a of promises) {
      for (let [k, v] of Object.entries(await a)) {
        aliases[k] = [...(aliases[k] || []), ...deps.util.toArray(v)]
      }
    }
    return aliases
  }

  public async findCommand(id: string): Promise<ICommand | undefined> {
    await this.init()
    if (!(await this.commandIDs()).includes(id)) return
    let cmd = await this._findCommand(await this.unalias(id))
    if (cmd) return cmd
    for (let m of await this.submanagers) {
      const errHandle = (err: Error) => cli.warn(err, { context: `findCommand: ${this.constructor.name}` })
      let cmd = await m.findCommand(id).catch(errHandle)
      if (cmd) return cmd
    }
  }

  public async findCommandInfo(id: string): Promise<CommandInfo> {
    let cmd = await this.findCommand(id)
    if (!cmd) throw new Error(`${id} not found`)
    return {
      id,
      hidden: cmd.hidden,
      help: await this.findCommandHelp(id),
      helpLine: await this.findCommandHelpLine(id),
    }
  }

  protected require(p: string, id: string): ICommand {
    this.debug('Reading command %s at %s', id, p)
    let Command: ICommand | undefined
    try {
      Command = deps.util.undefault(require(p))
    } catch (err) {
      cli.warn(err, { context: `Error reading command from ${p}` })
    }
    if (!Command || !Command._version) {
      let extra = deps.util.isEmpty(Command)
        ? 'Does the command have `export default class extends Command {...}`?'
        : `Received: ${inspect(Command)}`
      throw new Error(`${p} does not appear to be a valid command.\n${extra}`)
    }
    return Command
  }

  protected debug = require('debug')(`cli:plugins:${this.constructor.name.split('Plugin')[0].toLowerCase()}`)
  protected async _init(): Promise<void> {}
  protected async _topics(): Promise<Topics> {
    return {}
  }
  protected async _commandIDs(): Promise<string[]> {
    return []
  }
  protected async _aliases(): Promise<Aliases> {
    return {}
  }
  protected async _findCommand(_: string): Promise<ICommand | undefined> {
    return undefined
  }

  private async unalias(id: string): Promise<string> {
    const aliases = Object.entries(await this._aliases())
    const alias = aliases.find(([, aliases]) => aliases.includes(id))
    return alias ? alias[0] : id
  }

  private async initSubmanagers() {
    const errHandle = (err: Error) => cli.warn(err, { context: `init: ${this.constructor.name}` })
    const promises = this.submanagers.map(m => m.init().catch(errHandle))
    for (let s of promises) await s
  }

  private async addCommandsToTopics(topics: Topics) {
    for (let command of await this._commandIDs()) {
      const topicID = Topic.parentTopicIDof(command)
      if (!topicID) continue
      const info = await this.findCommandInfo(command)
      let topic = await Topic.findOrCreateTopic({ name: topicID }, topics)
      topic.commands[command] = info
    }
  }

  private async findCommandHelpLine(id: string): Promise<[string, string | undefined]> {
    const c = await this.findCommand(id)
    if (!c) throw new Error('command not found')
    return c.buildHelpLine(this.config)
  }

  private async findCommandHelp(id: string): Promise<string> {
    const c = await this.findCommand(id)
    if (!c) throw new Error('command not found')
    let help = c.buildHelp(this.config)
    if (!color.supportsColor) help = deps.stripAnsi(help)
    return help
  }
}
