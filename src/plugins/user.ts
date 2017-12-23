import { IConfig } from 'cli-engine-config'
import cli from 'cli-ux'
import * as path from 'path'
import deps from '../deps'
import { Lock } from '../lock'
import { PluginManifest } from './manifest'
import { IPluginOptions, Plugin, PluginType } from './plugin'
import Yarn from './yarn'

export class UserPlugins {
  public plugins: UserPlugin[]
  private manifest: PluginManifest
  private lock: Lock
  private debug: any

  constructor(private config: IConfig) {
    this.debug = require('debug')('cli:plugins:user')
  }

  public async submanagers() {
    await this.init()
    return this.plugins
  }

  public async update() {
    if (this.plugins.length === 0) return
    cli.action.start(`${this.config.name}: Updating plugins`)
    const yarn = this.yarn()
    const manifest = await this.manifest.get('plugins')
    const packages = Object.entries(manifest || {}).map(([k, v]) => `${k}@${v}`)
    await yarn.exec(['upgrade', ...packages])
  }

  public async install(name: string, tag: string): Promise<void> {
    await this.init()
    let downgrade = await this.lock.upgrade()
    await this.createPJSON()
    const yarn = this.yarn()
    await yarn.exec(['add', `${name}@${tag}`])
    const plugin = await this.loadPlugin(name, tag)
    await plugin.init()
    await plugin.resetCache()
    await plugin.load()
    await this.addPlugin(name, tag)
    await downgrade()
  }

  public async uninstall(name: string): Promise<void> {
    const yarn = this.yarn()
    await yarn.exec(['remove', name])
    await this.manifest.set(name, undefined)
  }

  public async needsRefresh() {
    await this.init()
    if (!this.plugins.length) return false
    let plugin = this.plugins[0]
    if ((await plugin.yarnNodeVersion()) !== process.versions.node) return true
    return false
  }

  public async refresh() {
    if (!await this.needsRefresh()) return
    const yarn = this.yarn()
    await yarn.exec()
    for (let p of this.plugins.map(p => p.resetCache())) await p
  }

  public async init() {
    if (this.plugins) return
    this.debug('init')
    this.manifest = new deps.PluginManifest({
      name: 'user',
      file: path.join(this.config.dataDir, 'plugins', 'user.json'),
    })
    this.lock = new deps.Lock(this.config, this.manifest.file + '.lock')
    await this.migrate()
    const manifest = await this.manifest.get('plugins')
    this.plugins = await Promise.all(Object.entries(manifest || {}).map(([k, v]) => this.loadPlugin(k, v.tag)))
    if (this.plugins.length) this.debug('plugins:', this.plugins.map(p => p.name).join(', '))
  }

  private async loadPlugin(name: string, tag: string): Promise<UserPlugin> {
    const pjson = await deps.file.fetchJSONFile(path.join(this.userPluginPath(name), 'package.json'))
    return new UserPlugin({
      pjson,
      tag,
      root: this.userPluginPath(name),
      config: this.config,
    })
  }

  private userPluginPath(name: string): string {
    return path.join(this.userPluginsDir, 'node_modules', name)
  }

  private get userPluginsDir() {
    return path.join(this.config.dataDir, 'plugins')
  }
  private get pjsonPath() {
    return path.join(this.userPluginsDir, 'package.json')
  }

  private yarn() {
    return new Yarn({ config: this.config, cwd: this.userPluginsDir })
  }

  private async createPJSON() {
    if (!await deps.file.exists(this.pjsonPath)) {
      await deps.file.outputJSON(this.pjsonPath, { private: true, 'cli-engine': { schema: 1 } }, { spaces: 2 })
    }
  }

  private async migrate() {
    const userPath = path.join(this.config.dataDir, 'plugins', 'package.json')
    if (!await deps.file.exists(userPath)) return
    let user = await deps.file.readJSON(userPath)
    if (!user.dependencies || user['cli-engine']) return
    this.debug('migrating user plugins')
    user = await deps.file.readJSON(userPath)
    if (user['cli-engine']) return
    for (let [name, tag] of Object.entries(user.dependencies)) {
      await this.addPlugin(name, tag)
    }
    user = await deps.file.readJSON(userPath)
    user['cli-engine'] = { schema: 1 }
    await deps.file.outputJSON(userPath, user)
  }

  private async addPlugin(name: string, tag: string) {
    let plugins = (await this.manifest.get('plugins')) || {}
    plugins[name] = { tag }
    await this.manifest.set('plugins', plugins)
    await this.manifest.save()
  }
}

export type UserPluginOptions = IPluginOptions & {
  tag: string
}

export class UserPlugin extends Plugin {
  public type: PluginType = 'user'
  public tag: string

  constructor(opts: UserPluginOptions) {
    super(opts)
    this.tag = opts.tag || 'latest'
  }
}
