import deps from '../deps'
import { PluginManager } from './manager'
import { ICommand, Config } from 'cli-engine-config'
import * as path from 'path'
import { Lock } from '../lock'
import { PluginCache } from './cache'

export type PluginType = 'builtin' | 'core' | 'user' | 'link'
export type PluginOptions = {
  config: Config
  cache: PluginCache | undefined
  root: string
  lock?: Lock
}

export type PluginPJSON = {
  name: string
  version: string
  main?: string
  scripts?: { [k: string]: string }
  'cli-engine': {
    commandsDir?: string
    aliases?: { [k: string]: string | string[] }
  }
}

export type PluginTopic = {
  name: string
  description?: string
  hidden?: boolean
}

export type PluginModule = {
  commands: ICommand[]
  topic?: PluginTopic
  topics: PluginTopic[]
}

export abstract class Plugin extends PluginManager {
  public name: string
  public version: string
  public abstract type: PluginType
  public root: string
  public tag?: string
  public pjson: PluginPJSON

  // @ts-ignore
  protected lock?: Lock
  protected cache?: PluginCache

  constructor(options: PluginOptions) {
    super(options)
    this.cache = options.cache
    this.root = options.root
    this.lock = options.lock
  }

  protected async _init() {
    this.pjson = await deps.file.fetchJSONFile(path.join(this.root, 'package.json'))
    if (!this.pjson['cli-engine']) this.pjson['cli-engine'] = {}
    this.name = this.pjson.name
    this.version = this.pjson.version
    this.debug = require('debug')(`cli:plugins:${this.name}`)
  }

  public get commandsDir(): string | undefined {
    let d = this.pjson['cli-engine'].commandsDir
    if (d) return path.join(this.root, d)
  }

  public async commandIDs() {
    return deps.util.concatPromiseArrays([this.commandIDsFromDir(), this.fetchCommandIDsFromModule()])
  }

  public async aliases() {
    return deps.util.objValsToArrays(this.pjson['cli-engine'].aliases)
  }

  public async findCommand(id: string): Promise<ICommand | undefined> {
    let cmd = await this.findCommandInModule(id)
    if (!cmd) cmd = await this.findCommandInDir(id)
    if (cmd) {
      cmd = this.addPluginToCommand(cmd)
      return cmd
    }
  }

  public async findCommandInModule(id: string) {
    const ids = await this.fetchCommandIDsFromModule()
    if (!ids.includes(id)) return
    const m = await this.fetchModule()
    if (!m) return
    return m.commands.find(c => c.id === id)
  }

  public async findCommandInDir(id: string) {
    const dir = this.commandsDir
    if (!dir) return
    let p
    try {
      p = this.commandPath(id)
    } catch (err) {
      if (err.code === 'MODULE_NOT_FOUND') return
      throw err
    }
    if (!await deps.file.exists(p)) return
    return this.require(p, id)
  }

  protected addPluginToCommand(cmd: ICommand): ICommand {
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

  private _module: Promise<PluginModule | undefined>
  private async fetchModule(): Promise<PluginModule | undefined> {
    if (this._module) return this._module
    return (this._module = (async () => {
      if (!this.pjson.main) return
      this.debug(`requiring ${this.name}@${this.version}`)

      const m: PluginModule = {
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

  private async fetchCommandIDsFromModule(): Promise<string[]> {
    const fn = async () => {
      const m = await this.fetchModule()
      if (!m) return []
      return m.commands.map(m => m.id)
    }
    return this.cache ? this.cache.fetch(this, 'commandIDs', fn) : fn()
  }

  private commandIDsFromDir(): Promise<string[]> {
    const d = this.commandsDir
    if (!d) return Promise.resolve([])
    return new Promise((resolve, reject) => {
      let ids: string[] = []
      deps
        .klaw(d, { depthLimit: 10 })
        .on('data', f => {
          if (!f.stats.isDirectory() && f.path.endsWith('.js')) {
            let parsed = path.parse(f.path)
            let p = path.relative(d, path.join(parsed.dir, parsed.name))
            ids.push(p.split(path.sep).join(':'))
          }
        })
        .on('error', reject)
        .on('end', () => resolve(ids))
    })
  }
}
