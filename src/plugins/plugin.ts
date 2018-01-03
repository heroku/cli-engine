import { ICommand } from '@cli-engine/config'
import cli from 'cli-ux'
import * as path from 'path'
import RWLockfile, { rwlockfile } from 'rwlockfile'

import { ICommandInfo, ICommandManager, ILoadResult } from '../command'
import Config from '../config'
import deps from '../deps'
import { ITopic, ITopics, topicsToArray } from '../topic'

import { PluginManifest } from './manifest'

export type PluginType = 'builtin' | 'main' | 'core' | 'user' | 'link'

export interface IPluginPJSON {
  name: string
  version: string
  main?: string
  scripts?: { [k: string]: string }
  'cli-engine': {
    commands?: string
    topics?: ITopics
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
  config: Config
  root: string
  pjson: IPluginPJSON
  type: string
}

export abstract class Plugin implements ICommandManager {
  public type: PluginType
  public name: string
  public version: string
  public tag?: string
  public pjson: IPluginPJSON
  public root: string
  protected config: Config
  protected debug: any
  protected lock: RWLockfile
  private _module: Promise<IPluginModule>
  private cache: PluginManifest

  constructor(opts: IPluginOptions) {
    this.config = opts.config
    this.root = opts.root
    this.pjson = opts.pjson
    if (!this.pjson['cli-engine']) this.pjson['cli-engine'] = {}
    this.name = this.name || this.pjson.name
    this.version = this.version || this.pjson.version
    let cacheKey = [this.config.version, this.version].join(path.sep)
    let cacheFile = path.join(this.config.cacheDir, 'plugins', [opts.type, this.name + '.json'].join(path.sep))
    this.cache = new deps.PluginManifest({ file: cacheFile, invalidate: cacheKey, name: this.name })
    this.debug = require('debug')(`cli:plugins:${[opts.type, this.name, this.version].join(':')}`)
    this.lock = new RWLockfile(cacheFile, { ifLocked: () => cli.action.start(`Plugin ${this.name} is updating`) })
  }

  @rwlockfile('lock', 'read')
  public async load(): Promise<ILoadResult> {
    const results = {
      commands: await this.commands(),
      topics: await this.topics(),
    }
    if (this.cache.needsSave) {
      let canWrite = await this.lock.check('write')
      if (canWrite.status === 'open') {
        this.debug('saving cache')
        await this.lock.add('write', { reason: 'cache' })
        await this.cache.save()
        await this.lock.remove('write')
      } else {
        this.debug(`cannot save cache: ${canWrite.status}`)
      }
    }
    return results
  }

  @rwlockfile('lock', 'write')
  public async reset(reload = false) {
    await this.cache.reset()
    if (reload) await this.load()
  }

  public async findCommand(id: string, must: true): Promise<ICommand>
  public async findCommand(id: string, must?: boolean): Promise<ICommand | undefined>
  @rwlockfile('lock', 'read')
  public async findCommand(id: string, must = false): Promise<ICommand | undefined> {
    let cmd = await this.findCommandInModule(id)
    if (!cmd) cmd = await this.findCommandInDir(id)
    if (cmd) {
      cmd = this.addPluginToCommand(cmd)
      return cmd
    }
    if (must) throw new Error(`${id} not found`)
  }

  protected async commands(): Promise<ICommandInfo[]> {
    const cache: ICommandInfo[] = await this.cache.fetch('commands', async () => {
      this.debug('fetching commands')
      const commands = await deps
        .assync<any>([this.commandsFromModule(), this.commandsFromDir()])
        .flatMap<ICommandInfo>()
      if (!commands.length) throw new Error(`${this.name} has no commands. Is this a CLI plugin?`)
      const r = await Promise.all(commands)
      return r
    })
    return cache.map(c => ({
      ...c,
      run: async (argv: string[]) => {
        await this.lock.add('read', { reason: 'running plugin' })
        let cmd = await this.findCommand(c.id, true)
        let res
        if (!c._version || c._version === '0.0.0') {
          // this.debug('legacy @cli-engine/command version', c._version)
          res = await (cmd as any).run({ ...this.config, argv: argv.slice(4) })
        } else if (deps.semver.lt(c._version || '', '11.0.0-beta.0')) {
          // this.debug(`legacy @cli-engine/command version`, c._version)
          res = await (cmd as any).run({ ...this.config, argv: argv.slice(2) })
        } else {
          res = await cmd.run(argv.slice(3), this.config)
        }
        await this.lock.remove('read')
        return res
      },
    }))
  }

  protected async topics(): Promise<ITopic[]> {
    const cache: ITopic[] = await this.cache.fetch('topics', async () => {
      this.debug('fetching topics')
      const m = await this.fetchModule()
      if (!m) return []
      return m.topics
    })
    let pjsonTopics = this.pjson['cli-engine'].topics
    if (pjsonTopics) return cache.concat(topicsToArray(pjsonTopics))
    return cache
  }

  protected get commandsDir(): string | undefined {
    let d = this.pjson['cli-engine'].commands
    if (d) return path.join(this.root, d)
  }

  protected commandIDsFromDir(): Promise<string[]> {
    const d = this.commandsDir
    if (!d) return Promise.resolve([])
    return new Promise((resolve, reject) => {
      let ids: string[] = []
      deps
        .klaw(d, { depthLimit: 10 })
        .on('data', f => {
          if (
            !f.stats.isDirectory() &&
            (f.path.endsWith('.js') || (f.path.endsWith('.ts') && this.type === 'builtin')) &&
            !f.path.endsWith('.d.ts') &&
            !f.path.endsWith('.test.js')
          ) {
            let parsed = path.parse(f.path)
            let p = path.relative(d, path.join(parsed.dir, parsed.name))
            if (path.basename(p) === 'index') p = path.dirname(p)
            ids.push(p.split(path.sep).join(':'))
          }
        })
        .on('error', reject)
        .on('end', () => resolve(ids))
    })
  }

  private commandPath(id: string): string {
    if (!this.commandsDir) throw new Error('commandsDir not set')
    return require.resolve(path.join(this.commandsDir, id.split(':').join(path.sep)))
  }

  private async commandsFromModule(): Promise<ICommandInfo[]> {
    const m = await this.fetchModule()
    if (!m) return []
    return deps.assync(m.commands).map(c => this.commandInfoFromICommand(c))
  }

  private async commandsFromDir(): Promise<ICommandInfo[]> {
    const ids = await this.commandIDsFromDir()
    return deps
      .assync(ids)
      .map(id => ({ cmd: this.findCommandInDir(id), id }))
      .map(({ cmd, id }) => this.commandInfoFromICommand(cmd, id))
  }

  private async commandInfoFromICommand(icommand: ICommand, id = icommand.id): Promise<ICommandInfo> {
    return {
      id,
      _version: icommand._version,
      description: icommand.description,
      usage: icommand.usage,
      plugin: { name: this.name, version: this.version },
      hidden: icommand.hidden,
      aliases: icommand.aliases || [],
      help: await icommand.buildHelp(this.config),
      helpLine: await icommand.buildHelpLine(this.config),
      run: async () => cli.warn(`run ${this.name}`),
    }
  }

  private findCommandInDir(id: string): ICommand {
    let c = deps.util.undefault(require(this.commandPath(id)))
    if (!c.id) c.id = id
    return c
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
