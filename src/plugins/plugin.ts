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
  pjson?: IPluginPJSON
  type: PluginType
}

interface TSConfig {
  compilerOptions: {
    rootDir?: string
    outDir?: string
  }
}

export abstract class Plugin implements ICommandManager {
  public type: PluginType
  public name: string
  public version: string
  public tag?: string
  public pjson: IPluginPJSON
  public root: string
  public commandsDir?: string
  protected config: Config
  protected debug: any
  protected lock: RWLockfile
  protected result: ILoadResult
  private _module: Promise<IPluginModule>
  private cache: PluginManifest
  private tsconfig?: TSConfig

  constructor(opts: IPluginOptions) {
    this.config = opts.config
    this.root = opts.root
    this.pjson = opts.pjson || deps.readPkg.sync(this.root)
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

  @rwlockfile('lock', 'read')
  public async load(): Promise<ILoadResult> {
    if (this.result) return this.result
    this.tsconfig = await this.fetchTSConfig()
    this.commandsDir = this.fetchCommandsDir()
    this.result = {
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
    return this.result
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

  protected fetchCommandsDir(): string | undefined {
    let commandsDir = this.pjson['cli-engine'].commands
    if (!commandsDir) return
    commandsDir = path.join(this.root, commandsDir)
    if (this.tsconfig) {
      this.debug('tsconfig.json found, skipping cache for main commands')
      let { rootDir, outDir } = this.tsconfig.compilerOptions
      if (rootDir && outDir) {
        try {
          this.debug('using ts files')
          require('ts-node').register()
          const lib = path.join(this.root, outDir)
          const src = path.join(this.root, rootDir)
          const relative = path.relative(lib, commandsDir)
          commandsDir = path.join(src, relative)
        } catch (err) {
          this.debug(err)
        }
      }
    }
    return commandsDir
  }

  protected async commandIDsFromDir(): Promise<string[]> {
    const d = this.commandsDir
    if (!d) return Promise.resolve([])
    this.debug(`loading IDs from ${d}`)
    const files = await deps.globby(['**/*.+(js|ts)', '!**/*.+(d.ts|test.ts|test.js)'], { nodir: true, cwd: d })
    const ids = files
      .map(path.parse)
      .map(p => _.compact([...p.dir.split(path.sep), p.name === 'index' ? '' : p.name]).join(':'))
    this.debug(`commandIDsFromDir dir:%s, ids:%o`, d, ids)
    return ids
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

  private async fetchTSConfig(): Promise<TSConfig | undefined> {
    try {
      const tsconfig = await deps.file.readJSON(path.join(this.root, 'tsconfig.json'))
      return tsconfig.compilerOptions && tsconfig
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }
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
