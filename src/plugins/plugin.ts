import { ICommand, IConfig } from 'cli-engine-config'
import cli from 'cli-ux'
import * as path from 'path'
import { ICommandInfo, ICommandManager, ILoadResult } from '../command'
import deps from '../deps'
import { Lock } from '../lock'
import { PluginManifest } from './manifest'

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
  pjson?: IPluginPJSON
}

export abstract class Plugin implements ICommandManager {
  public abstract type: PluginType
  public name: string
  public version: string
  public tag?: string
  public pjson: IPluginPJSON
  public root: string
  protected config: IConfig
  protected debug: any
  protected lock: Lock
  private _module: Promise<IPluginModule>
  private cache: PluginManifest

  constructor(opts: IPluginOptions) {
    this.config = opts.config
    this.root = opts.root
  }

  public async load(): Promise<ILoadResult> {
    await this.init()
    const results = {
      commands: await this.commands(),
    }
    if (this.cache.needsSave) {
      let downgrade = await this.lock.write()
      await this.cache.save()
      await downgrade()
    }
    return results
  }

  public async yarnNodeVersion(): Promise<string | undefined> {
    try {
      let f = await deps.file.readJSON(path.join(this.root, '..', '.yarn-integrity'))
      return f.nodeVersion
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }
  }

  public async resetCache() {
    await this.init()
    await this.cache.reset()
  }

  public async init() {
    this.pjson = this.pjson || (await deps.file.fetchJSONFile(path.join(this.root, 'package.json')))
    if (!this.pjson['cli-engine']) this.pjson['cli-engine'] = {}
    this.name = this.name || this.pjson.name
    this.version = this.version || this.pjson.version
    let cacheKey = [this.config.version, this.version].join(path.sep)
    let cacheFile = path.join(this.config.cacheDir, 'plugins', [this.type, this.name + '.json'].join(path.sep))
    this.cache = new deps.PluginManifest({ file: cacheFile, invalidate: cacheKey, name: this.name })
    this.lock = new deps.Lock(this.config, cacheFile + '.lock')
    this.debug = require('debug')(`cli:plugins:${[this.type, this.name, this.version].join(':')}`)
    this.debug('init')
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
    const cache: ICommandInfo[] = await this.cache.fetch('commands', async () => {
      this.debug('fetching commands')
      const commands = await deps
        .assync<any>([this.commandsFromModule(), this.commandsFromDir()])
        .flatMap<ICommandInfo>()
      if (!commands.length) throw new Error(`${this.name} has no commands`)
      return Promise.all(commands)
    })
    return cache.map(c => ({
      ...c,
      run: async (argv: string[]) => {
        let cmd = await this.findCommand(c.id, true)
        if (!c._version || c._version === '0.0.0') {
          // this.debug('legacy cli-engine-command version', c._version)
          return (cmd as any).run({ ...this.config, argv: argv.slice(4) })
        } else if (deps.semver.lt(c._version || '', '11.0.0')) {
          // this.debug(`legacy cli-engine-command version`, c._version)
          return (cmd as any).run({ ...this.config, argv: argv.slice(2) })
        } else {
          return cmd.run(argv.slice(3), this.config)
        }
      },
    }))
  }

  protected get commandsDir(): string | undefined {
    let d = this.pjson['cli-engine'].commandsDir
    if (d) return path.join(this.root, d)
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
      aliases: (icommand as any).aliases || [],
      help: await icommand.buildHelp(this.config),
      helpLine: await icommand.buildHelpLine(this.config),
      run: async () => cli.warn(`run ${this.name}`),
    }
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

  private commandIDsFromDir(): Promise<string[]> {
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
