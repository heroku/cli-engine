import deps from '../deps'
import * as path from 'path'
import cli from 'cli-ux'
import { Command as CommandBase } from 'cli-engine-command'
import { Config, Topic as BaseTopic, ICommand } from 'cli-engine-config'
import { Lock } from '../lock'
import { PluginManifest } from './manifest'
import { PluginTopic } from './plugin'
import { inspect } from 'util'
import _ from 'ts-lodash'

const debug = require('debug')('cli:plugins')

export type Topic = BaseTopic & { commands: string[] }

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
  manifest?: PluginManifest
}

export abstract class PluginManager {
  public topics: { [name: string]: Topic } = {}
  public commandIDs: string[] = []
  public aliases: { [from: string]: string[] } = {}

  protected submanagers: PluginManager[] = []
  protected config: Config
  protected manifest: PluginManifest
  protected lock: Lock
  protected userPluginsDir: string

  private initialized = false

  constructor(opts: PluginManagerOptions) {
    this.config = opts.config
    this.manifest = opts.manifest || new deps.PluginManifest(this.config)
    this.lock = new deps.Lock(this.config)
    this.userPluginsDir = path.join(this.config.dataDir, 'plugins')
  }

  public async init(): Promise<void> {
    if (this.initialized) return
    await this.manifest.init()
    await this._init()
    await Promise.all(this.submanagers.map(m => m.init()))
    this.initialized = true
    this.mergeCommandIDs()
    this.mergeTopics()
    this.addMissingTopics()
    this.mergeAliases()
  }
  protected abstract async _init(): Promise<void>

  public get topicIDs(): string[] {
    return Object.keys(this.topics)
  }

  public get rootCommandIDs(): string[] {
    return this.commandIDs.filter(id => !id.includes(':'))
  }

  public findCommand(id: string): ICommand | undefined {
    id = this.unalias(id)
    let cmd = this._findCommand(id)
    if (cmd) return cmd
    for (let m of this.submanagers) {
      let cmd = m.findCommand(id)
      if (cmd) return cmd
    }
  }

  protected _findCommand(_: string): ICommand | undefined {
    return undefined
  }

  protected require(p: string, id: string): ICommand {
    debug('Reading command %s at %s', id, p)
    let Command: undefined | typeof CommandBase
    try {
      Command = deps.util.undefault(require(p))
    } catch (err) {
      cli.warn(err, { context: `Error reading command from ${p}` })
    }
    if (!Command || !(Command.prototype instanceof CommandBase)) {
      let extra = deps.util.isEmpty(Command)
        ? 'Does the command have `export default class extends Command {...}`?'
        : `Received: ${inspect(Command)}`
      throw new Error(`${p} does not appear to be a valid command.\n${extra}`)
    }
    return Command
  }

  protected loadCommandsFromDir(d: string): Promise<void> {
    return new Promise((resolve, reject) => {
      deps
        .klaw(d, { depthLimit: 10 })
        .on('data', f => {
          if (!f.stats.isDirectory() && f.path.endsWith('.js')) {
            let parsed = path.parse(f.path)
            let p = path.relative(d, path.join(parsed.dir, parsed.name))
            this.commandIDs.push(p.split(path.sep).join(':'))
          }
        })
        .on('error', reject)
        .on('end', resolve)
    })
  }

  private unalias(id: string): string {
    const alias = Object.entries(this.aliases).find(([, aliases]) => aliases.includes(id))
    return alias ? alias[0] : id
  }

  private mergeCommandIDs() {
    for (let m of this.submanagers) {
      this.commandIDs = [...this.commandIDs, ...m.commandIDs]
    }
    this.commandIDs = _.compact(this.commandIDs.sort())
  }

  private mergeTopics() {
    for (let m of this.submanagers) {
      for (let t of Object.values(m.topics)) {
        this.topics[t.name] = mergeTopics(this.topics[t.name], t)
      }
    }
  }

  private addMissingTopics() {
    for (let id of this.commandIDs) {
      const topic = topicFromID(id)
      if (!topic) continue
      // create topic if none exist
      this.topics[topic] = this.topics[topic] || { name: topic, commands: [] }

      // add this command to the topic
      this.topics[topic].commands = this.topics[topic].commands || []
      this.topics[topic].commands.push(id)
    }
  }

  private mergeAliases() {
    for (let m of this.submanagers) {
      for (let [k, v] of Object.entries(m.aliases)) {
        this.aliases[k] = [...(this.aliases[k] || []), ...deps.util.toArray(v)]
      }
    }
  }
}
