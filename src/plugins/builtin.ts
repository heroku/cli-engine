import deps from '../deps'
import { IConfig } from 'cli-engine-config'
import { ICommand } from 'cli-engine-config'
import * as path from 'path'
import { PluginCache } from './cache'
import { PluginManifest } from './manifest'
import { ITopics, Topic } from './topic'
import {Command} from 'cli-engine-command'
import {ICommandInfo, ILoadResult, ICommandManager, RunFn} from '../command'
import {Lock} from '../lock'

export type PluginType = 'builtin' | 'core' | 'user' | 'link'

export interface IPluginPJSON {
  name: string
  version: string
  main?: string
  scripts?: { [k: string]: string }
  'cli-engine': {
    commandsDir?: string
    aliases?: { [k: string]: string | string[] }
  }
}

export interface IPluginTopic {
  name: string
  description?: string
  hidden?: boolean
}

export interface IPluginModule {
  commands: ICommand[]
  topic?: IPluginTopic
  topics: IPluginTopic[]
}

export interface IPluginOptions {
  config: IConfig
  root: string
  pjson: IPluginPJSON
}

export abstract class Plugin implements ICommandManager {
  public abstract type: PluginType
  public name: string
  public version: string
  public pjson: IPluginPJSON
  public root: string
  protected config: IConfig
  protected debug: any
  private _module: Promise<IPluginModule>
  private cache: PluginCache
  private lock: Lock

  constructor(opts: IPluginOptions) {
    this.root = opts.root
  }

  public async load(): Promise<ILoadResult> {
    this.pjson = this.pjson || await deps.file.fetchJSONFile(path.join(this.root, 'package.json'))
    if (!this.pjson['cli-engine']) this.pjson['cli-engine'] = {}
    this.name = this.pjson.name
    this.version = this.pjson.version
    let cacheName = [this.type, this.name].join(path.sep)
    let cacheKey = [this.config.version, this.version].join(path.sep)
    this.cache = new PluginCache(this.config, cacheName, cacheKey)
    this.lock = new Lock(this.config, cacheName)
    this.debug = require('debug')(`cli:plugins:${[this.type, this.name, this.version].join(':')}`)
    await this.lock.read()
    const results = {
      commands: await this.commands()
    }
    let downgrade = await this.lock.upgrade()
    await this.cache.save()
    await downgrade()
    return results
  }

  protected async commands (): Promise<ICommandInfo[]> {
    const cache: ICommandInfo[] = await this.cache.fetch('commands', async () => {
      this.debug('fetching commands')
      const commands = await deps.assync<any>([this.commandsFromModule(), this.commandsFromDir()]).flatMap<ICommandInfo>()
      if (!commands.length) throw new Error(`${this.name} has no commands`)
      return Promise.all(commands)
    })
    return cache.map(c => ({
        ...c,
        run: async (argv: string[]) => {
          let cmd = await this.findCommand(c.id, true)
          cmd.run(argv.slice(3), this.config)
        }
    }))
  }

  private async commandsFromModule(): Promise<ICommandInfo[]> {
    const m = await this.fetchModule()
    if (!m) return []
    return deps.assync(m.commands).map(c => this.commandInfoFromICommand(c))
  }

  private async commandsFromDir(): Promise<ICommandInfo[]> {
    const ids = await this.commandIDsFromDir()
    return deps.assync(ids)
      .map(id => this.findCommandInDir(id))
      .map(c => this.commandInfoFromICommand(c))
  }

  private async commandInfoFromICommand(icommand: ICommand): Promise<ICommandInfo> {
    return {
      id: icommand.id,
      hidden: icommand.hidden,
      help: await icommand.buildHelp(this.config),
      helpLine: await icommand.buildHelpLine(this.config),
    } as ICommandInfo
  }

  private async findCommand(id: string, must: true): Promise<ICommand>
  private async findCommand(id: string, must?: boolean): Promise<ICommand | undefined>
  private async findCommand(id: string, must = false): Promise<ICommand | undefined> {
    let cmd = await this.findCommandInModule(id)
    if (!cmd) cmd = await this.findCommandInDir(id)
    if (cmd) {
      cmd = this.addPluginToCommand(cmd)
      return cmd
    }
    if (must) throw new Error(`${id} not found`)
  }

  private findCommandInDir(id: string): ICommand {
    return deps.util.undefault(require(this.commandPath(id)))
  }

  private async findCommandInModule(id: string) {
    const m = await this.fetchModule()
    if (!m) return
    return m.commands.find(c => c.id === id)
  }

  private addPluginToCommand(cmd: ICommand): ICommand {
    cmd.plugin = {
      type: this.type,
      root: this.root,
      name: this.name,
      version: this.version,
    }
    return cmd
  }

  private commandPath(id: string): string {
    if (!this.commandsDir) throw new Error('commandsDir not set')
    return require.resolve(path.join(this.commandsDir, id.split(':').join(path.sep)))
  }

  private commandIDsFromDir(): Promise<string[]> {
    const d = this.commandsDir
    if (!d) return Promise.resolve([])
    return new Promise((resolve, reject) => {
      let ids: string[] = []
      deps
        .klaw(d, { depthLimit: 10 })
        .on('data', f => {
          if (!f.stats.isDirectory() && f.path.endsWith('.js') && !f.path.endsWith('.test.js')) {
            let parsed = path.parse(f.path)
            let p = path.relative(d, path.join(parsed.dir, parsed.name))
            ids.push(p.split(path.sep).join(':'))
          }
        })
        .on('error', reject)
        .on('end', () => resolve(ids))
    })
  }

  private get commandsDir(): string | undefined {
    let d = this.pjson['cli-engine'].commandsDir
    if (d) return path.join(this.root, d)
  }

  private async fetchModule(): Promise<IPluginModule | undefined> {
    if (!this.pjson.main) return
    if (this._module) return this._module
    return (this._module = (async () => {
      this.debug(`requiring ${this.name}@${this.version}`)

      const m: IPluginModule = {
        commands: [],
        topics: [],
        ...require(path.join(this.root, this.pjson.main!)),
      }

      if (m.topic) m.topics.push(m.topic)
      m.commands = m.commands.map(deps.util.undefault)

      const hooks = new deps.Hooks(this.config)
      await hooks.run('plugins:parse', { module: m, pjson: this.pjson })

      let legacy = new deps.PluginLegacy(this.config)

      return legacy.convert(m)
    })())
  }
}

export class Builtin extends Plugin implements ICommandManager {
  public type: PluginType = 'builtin'

  constructor(protected config: IConfig) {
    super({
      config,
      root: path.join(__dirname, '..', '..'),
      pjson: require('../../package.json'),
    })
  }

  // public async _topics(): Promise<ITopics> {
  //   const topics: ITopics = {}
  //   if (this.config.userPlugins) {
  //     topics.plugins = new Topic({
  //       name: 'plugins',
  //       description: 'manage plugins',
  //     })
  //   }
  //   return topics
  // }
}
