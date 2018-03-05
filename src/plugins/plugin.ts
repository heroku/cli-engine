import { Help } from '@cli-engine/command/lib/help'
import { ICommand } from '@cli-engine/config'
import cli from 'cli-ux'
import * as path from 'path'
import RWLockfile, { rwlockfile } from 'rwlockfile'
import _ from 'ts-lodash'

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
  oclif: {
    commands?: string
    topics?: ITopics
  }
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
  type: PluginType
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
  protected result: ILoadResult
  protected skipCache?: boolean
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
    this.type = opts.type
  }

  public async load(): Promise<ILoadResult> {
    if (this.result) return this.result
    this.result = {
      commands: await this.commands(),
      topics: await this.topics(),
    }
    return this.result
  }

  @rwlockfile('lock', 'write')
  public async reset(reload = false) {
    await this.cache.reset()
    if (reload) await this.load()
  }

  public async findCommand(id: string, must: true): Promise<ICommand>
  public async findCommand(id: string, must?: boolean): Promise<ICommand | undefined>
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
    let cacheFetchCallback = function(that): () => Promise<ICommandInfo[]>  {
      return async function(): Promise<ICommandInfo[]> {
        that.debug('fetching commands')
        const commands = await deps
          .assync<any>([that.commandsFromModule(), that.commandsFromDir()])
          .flatMap<ICommandInfo>()
        const r = await Promise.all(commands)
        return r
      }
    }(this)

    let cache: ICommandInfo[] = await this.cacheFetch('commands', cacheFetchCallback)

    if (!cache) cache = await cacheFetchCallback()

    return cache.map(c => ({
      ...c,
      fetchCommand: () => this.findCommand(c.id, true),
      run: async (argv: string[]) => {
        // await this.lock.add('read', { reason: 'running plugin' })
        let cmd = await this.findCommand(c.id, true)
        let res
        let base = (cmd as any)._base
        if (base && base.startsWith('@oclif')) {
          res = await cmd.run(argv.slice(3) as any, { root: cmd.plugin!.root } as any)
        } else if (!c._version || c._version === '0.0.0') {
          // this.debug('legacy @cli-engine/command version', c._version)
          res = await (cmd as any).run({ ...this.config, argv: argv.slice(4) })
        } else if (deps.semver.lt(c._version || '', '10.0.0')) {
          // this.debug('legacy @cli-engine/command version', c._version)
          let cvrtConfig = this.convertConfig(this.config)
          res = await (cmd as any).run({ ...cvrtConfig, argv: argv.slice(1) })
        } else if (deps.semver.lt(c._version || '', '11.0.0-beta.0')) {
          // this.debug(`legacy @cli-engine/command version`, c._version)
          res = await (cmd as any).run({ ...this.config, argv: argv.slice(2) })
        } else {
          res = await cmd.run(argv.slice(3), this.config)
        }
        // await this.lock.remove('read')
        return res
      },
    }))
  }

  protected async topics(): Promise<ITopic[]> {
    const cache: ITopic[] = await this.cacheFetch('topics', async () => {
      this.debug('fetching topics')
      const m = await this.fetchModule()
      if (!m) return []
      return m.topics
    })
    let pjson = this.pjson.oclif || this.pjson['cli-engine']
    let pjsonTopics = pjson.topics
    if (pjsonTopics) return cache.concat(topicsToArray(pjsonTopics))
    return cache
  }

  protected get commandsDir(): string | undefined {
    let pjson = this.pjson.oclif || this.pjson['cli-engine']
    let d = pjson.commands
    if (d) return path.join(this.root, d)
  }

  protected async commandIDsFromDir(): Promise<string[]> {
    const d = this.commandsDir
    if (!d) return Promise.resolve([])
    this.debug(`loading IDs from ${d}`)
    const files = await deps.globby(['**/*.+(js|ts)', '!**/*.+(d.ts|test.ts|test.js)'], { nodir: true, cwd: d })
    const ids = files
      .map(path.parse)
      .map((p: any) => _.compact([...p.dir.split(path.sep), p.name === 'index' ? '' : p.name]).join(':'))
    this.debug(`commandIDsFromDir dir:%s, ids:%o`, d, ids)
    return ids
  }

  private commandPath(id: string): string {
    if (!this.commandsDir) throw new Error('commandsDir not set')
    return require.resolve(path.join(this.commandsDir, id.split(':').join(path.sep)))
  }

  private async commandsFromModule(): Promise<Partial<ICommandInfo>[]> {
    const m = await this.fetchModule()
    if (!m) return []
    return deps.assync(m.commands).map(c => this.commandInfoFromICommand(c))
  }

  private async commandsFromDir(): Promise<Partial<ICommandInfo>[]> {
    const ids = await this.commandIDsFromDir()
    return deps
      .assync(ids)
      .map(id => ({ cmd: this.findCommandInDir(id), id }))
      .map(({ cmd, id }) => this.commandInfoFromICommand(cmd, id))
  }

  private async commandInfoFromICommand(icommand: ICommand, id = icommand.id): Promise<Partial<ICommandInfo>> {
    let help = await (icommand.buildHelp ? icommand.buildHelp(this.config) : this.buildHelp(icommand))
    let helpLine = await (icommand.buildHelpLine ? icommand.buildHelpLine(this.config) : this.buildHelpLine(icommand))
    return {
      id,
      _version: icommand._version,
      description: icommand.description,
      usage: icommand.usage,
      plugin: { name: this.name, version: this.version },
      hidden: icommand.hidden,
      aliases: icommand.aliases || [],
      help,
      helpLine,
    }
  }

  private async buildHelp(c: ICommand): Promise<string> {
    return new Help(this.config).command(c)
  }

  private async buildHelpLine(c: ICommand) {
    return new Help(this.config).commandLine(c)
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

  private cacheFetch<T>(key: string, fn: () => Promise<T>) {
    return this.skipCache ? fn() : this.cache.fetch(key, fn)
  }

  private convertConfig(config: Config): Partial<Config> {
    return {
      argv: config.argv,
      bin: config.bin,
      channel: config.channel,
      name: config.name,
      reexecBin: config.reexecBin,
      root: config.root,
      version: config.version,
      arch: config.arch,
      platform: config.platform,
      windows: config.windows,
      corePlugins: config.corePlugins,
      defaultCommand: config.defaultCommand,
      hooks: config.hooks,
      npmRegistry: config.npmRegistry,
      topics: config.topics,
      userPluginsEnabled: config.userPluginsEnabled,
      s3: config.s3,
      dirname: config.dirname,
      home: config.home,
      cacheDir: config.cacheDir,
      configDir: config.configDir,
      dataDir: config.dataDir,
      errlog: config.errlog,
      pjson: config.pjson,
      userAgent: config.userAgent,
      commandsDir: config.commandsDir,
      updateDisabled: config.updateDisabled,
      shell: config.shell,
      debug: config.debug,
    }
  }
}
