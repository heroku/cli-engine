import deps from '../deps'
import cli from 'cli-ux'
import { Config, Topic as BaseTopic, ICommand } from 'cli-engine-config'
import { PluginTopic } from './plugin'
import { inspect } from 'util'

export type Topic = BaseTopic & { commands: string[] }
export type Topics = { [from: string]: Topic }
export type Aliases = { [from: string]: string[] }

function mergeTopics(a: PluginTopic, b: PluginTopic): Topic {
  return {
    ...a,
    ...b,
    commands: [],
  }
}

function topicFromID(id: string) {
  return id
    .split(':')
    .slice(0, -1)
    .join(':')
}

export type PluginManagerOptions = {
  config: Config
}

export abstract class PluginManager {
  protected submanagers: PluginManager[] = []
  protected config: Config

  constructor(opts: PluginManagerOptions) {
    this.config = opts.config
  }

  private _initPromise: Promise<void>
  public init(): Promise<void> {
    if (this._initPromise) return this._initPromise
    return (this._initPromise = (async () => {
      await this._init()
      await this.initSubmanagers()
    })())
  }
  protected async _init(): Promise<void> {}

  protected async initSubmanagers() {
    const promises = this.submanagers.map(m => m.init().catch(err => cli.warn(err)))
    for (let s of promises) await s
  }

  public async topics(): Promise<Topics> {
    const topics: Topics = {}
    await this.init()
    let promises = this.submanagers.map(m => {
      return m.topics().catch(err => cli.warn(err))
    })
    for (let p of promises) {
      for (let t of Object.values(p)) {
        topics[t.name] = mergeTopics(topics[t.name], t)
      }
    }
    return this.addMissingTopics(topics)
  }

  public async findTopic(name: string): Promise<Topic | undefined> {
    const topics = await this.topics()
    return topics[name]
  }

  public async topicIDs(): Promise<string[]> {
    return Object.keys(await this.topics())
  }

  public async commandIDs(): Promise<string[]> {
    await this.init()
    const p = this.submanagers.map(s => s.commandIDs().catch(err => cli.warn(err)))
    const ids = await deps.util.concatPromiseArrays(p)
    return ids.sort()
  }

  public async rootCommandIDs(): Promise<string[]> {
    let ids = await this.commandIDs()
    return ids.filter(id => !id.includes(':'))
  }

  public async aliases(): Promise<Aliases> {
    let aliases: Aliases = {}
    await this.init()
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
    for (let m of await this.submanagers) {
      let cmd = await m.findCommand(await m.unalias(id)).catch(err => cli.warn(err))
      if (cmd) return cmd
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

  private async unalias(id: string): Promise<string> {
    const aliases = Object.entries(await this.aliases())
    const alias = aliases.find(([, aliases]) => aliases.includes(id))
    return alias ? alias[0] : id
  }

  private async addMissingTopics(topics: Topics): Promise<Topics> {
    for (let id of await this.commandIDs()) {
      const topic = topicFromID(id)
      if (!topic) continue
      // create topic if none exist
      topics[topic] = topics[topic] || { name: topic, commands: [] }

      // add this command to the topic
      topics[topic].commands = topics[topic].commands || []
      topics[topic].commands.push(id)
    }
    return topics
  }
}
