import { ICommand, IConfig } from 'cli-engine-config'
import cli from 'cli-ux'
import _ from 'ts-lodash'
import { inspect } from 'util'
import deps from '../deps'
import { RootTopic, Topic } from '../topic'
import { PluginCache } from './cache'
import { PluginManifest } from './manifest'

export interface IAliases { [from: string]: string[] }

export interface IPluginManagerOptions {
  config: IConfig
  cache?: PluginCache
  manifest?: PluginManifest
}

const errHandle = (context: string, m: PluginManager) => (err: Error) => {
  m.errored = true
  cli.warn(err, { context: `${context}: ${m.constructor.name}` })
}

export abstract class PluginManager {
  public topic: Topic
  public commandIDs: string[]
  public aliases: IAliases
  public errored = false
  protected submanagers: PluginManager[] = []
  protected config: IConfig
  protected manifest: PluginManifest
  protected cache: PluginCache
  protected cacheKey: string
  protected debug = require('debug')(`cli:plugins:${this.constructor.name.split('Plugin')[0].toLowerCase()}`)
  protected promises: {[k: string]: Promise<void>} = {}

  constructor(opts: IPluginManagerOptions) {
    this.cacheKey = 'plugins'
    this.config = opts.config
    this.manifest = opts.manifest || new deps.PluginManifest(this.config)
    this.cache = opts.cache || new deps.PluginCache(this.config)
  }

  public init(): Promise<void> {
    if (this.promises.init) return this.promises.init
    return (this.promises.init = (async () => {
      await this._init()
      await this.initSubmanagers()
    })())
  }

  public load() {
    if (this.promises.load) return this.promises.load
    return this.promises.load = (async () => {
        // await this._load()
        // const promises = this.okSubmanagers.map(m => m.load.catch(errHandle('load', m)))
        // for (let s of promises) await s
        // // this.commandIDs = await this.fetchCommandIDs()
        // this.topic = await this.loadTopic()
        // // this.rootCommands = await this.fetchRootCommands()
        // // this.aliases = await this.fetchAliases()
    })()
  }

  public get needsRefresh(): Promise<boolean> {
    if (this._needsRefreshPromise) return this._needsRefreshPromise
    return (this._needsRefreshPromise = (async () => {
      if (await this._needsRefresh()) return true
      const promises = this.okSubmanagers.map(m => m.needsRefresh.catch(errHandle('needsRefresh', m)))
      for (let s of promises) if (await s) return true
      return false
    })())
  }

  public findTopic(name: string): Topic | undefined {
    return Topic.find(name, this.topics)
  }

  public refresh() {
    if (this._refreshPromise) return this._refreshPromise
    return (this._refreshPromise = (async () => {
      this.debug('refresh')
      await this._refresh()
      const promises = this.okSubmanagers.map(async m => {
        if (await m.needsRefresh) return m.refresh().catch(errHandle('refresh', m))
      })
      for (let s of promises) await s
    })())
  }

  public findCommand(id: string): Promise<ICommand | undefined> {
    if (this._commandFinders[id]) return this._commandFinders[id]
    return (this._commandFinders[id] = (async () => {
      if (!this.hasID(id)) return
      let cmd = await this._findCommand(await this.unalias(id))
      if (cmd) return cmd
      const promises = this.okSubmanagers.map(m => m.findCommand(id).catch(errHandle('findCommand', m)))
      for (let p of promises) {
        let cmd = await p
        if (cmd) return cmd
      }
    })())
  }

  public findCommandInfo(id: string): ICommandInfo | undefined {
    let cmd = this.rootCommands[id]
    if (cmd) return cmd
    let topic = Topic.find(Topic.parent(id), this.topics)
    if (!topic) return
    return topic.commands[id]
  }

  protected async _refresh(): Promise<void> {}
  protected async _load() {}
  protected async _needsRefresh(): Promise<boolean> { return false }
  protected async _init(): Promise<void> {}
  protected async _topics(): Promise<ITopics> {
    return {}
  }
  protected async _commandIDs(): Promise<string[]> {
    return []
  }
  protected async _aliases(): Promise<IAliases> {
    return {}
  }
  protected async _findCommand(_: string): Promise<ICommand | undefined> {
    return undefined
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

  protected hasID(id: string) {
    if (this.commandIDs.includes(id)) return true
    if (([] as string[]).concat(...Object.values(this.aliases)).includes(id)) return true
  }

  protected async _rootCommands(): Promise<ICommands> {
    const commands: ICommands = {}
    for (let command of await this._commandIDs()) {
      const topicID = Topic.parent(command)
      if (topicID) continue
      const info = await this.fetchCommandInfo(command)
      commands[command] = info
    }
    return commands
  }

  // private async fetchCommandIDs(): Promise<string[]> {
  //   const fetch = () => this._commandIDs()
  //   let ids = await this.cache.fetch(this.cacheKey, 'command:ids', fetch)
  //   return _.uniq(ids.concat(...this.okSubmanagers.map(s => s.commandIDs)).sort())
  // }

  // private async unalias(id: string): Promise<string> {
  //   const aliases = Object.entries(await this._aliases())
  //   const alias = aliases.find(([, aliases]) => aliases.includes(id))
  //   return alias ? alias[0] : id
  // }

  private async initSubmanagers() {
    const errHandle = (err: Error) => cli.warn(err, { context: `init: ${this.constructor.name}` })
    const promises = this.okSubmanagers.map(m => m.init().catch(errHandle))
    for (let s of promises) await s
  }

  // private async addCommandsToTopics(topics: ITopics) {
  //   for (let command of await this._commandIDs()) {
  //     const topicID = Topic.parent(command)
  //     if (!topicID) continue
  //     const info = await this.fetchCommandInfo(command)
  //     let topic = await Topic.find(topicID, topics, true)
  //     topic.commands[command] = info
  //   }
  // }

  // private async findCommandHelpLine(id: string): Promise<[string, string | undefined]> {
  //   const c = await this.findCommand(id)
  //   if (!c) throw new Error('command not found')
  //   return c.buildHelpLine(this.config)
  // }

  // private async findCommandHelp(id: string): Promise<string> {
  //   const c = await this.findCommand(id)
  //   if (!c) throw new Error('command not found')
  //   let help = c.buildHelp(this.config)
  //   if (!color.supportsColor) help = deps.stripAnsi(help)
  //   return help
  // }

  // private async fetchRootCommands(): Promise<ICommands> {
  //   const fetch = async () => await this._rootCommands()
  //   let rootCommands = await this.cache.fetch(this.cacheKey, 'root_commands', fetch)
  //   for (let s of this.okSubmanagers) {
  //     rootCommands = { ...rootCommands, ...s.rootCommands }
  //   }
  //   return rootCommands
  // }

  // private async fetchCommandInfo(id: string): Promise<ICommandInfo> {
  //   let cmd = await this.findCommand(id)
  //   if (!cmd) throw new Error(`${id} not found`)
  //   return {
  //     help: await this.findCommandHelp(id),
  //     helpLine: await this.findCommandHelpLine(id),
  //     hidden: cmd.hidden,
  //     id,
  //   }
  // }

  // private async fetchAliases(): Promise<IAliases> {
  //   const fetch = () => this._aliases()
  //   let aliases: IAliases = await this.cache.fetch(this.cacheKey, 'aliases', fetch)
  //   for (let s of this.okSubmanagers) {
  //     for (let [k, v] of Object.entries(s.aliases || {})) {
  //       aliases[k] = _.uniq([...(aliases[k] || []), ...deps.util.toArray(v)])
  //     }
  //   }
  //   return aliases
  // }

  private get okSubmanagers() {
    return this.submanagers.filter(m => !m.errored)
  }
}
