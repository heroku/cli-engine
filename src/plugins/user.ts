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
  public yarn: Yarn
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
    await this.init()
    if (this.plugins.length === 0) return
    cli.action.start(`${this.config.name}: Updating plugins`)
    await this.lock.write()
    const packages = Object.entries(await this.manifestPlugins()).map(([k, v]) => `${k}@${v.tag}`)
    await this.yarn.exec(['upgrade', ...packages])
    await this.lock.unwrite()
  }

  public async install(name: string, tag: string): Promise<void> {
    cli.action.start(`Installing ${name}@${tag}`)
    await this.init()
    await this.lock.write()
    await this.createPJSON()
    await this.yarn.exec(['add', `${name}@${tag}`])
    try {
      const plugin = await this.loadPlugin(name, tag)
      await plugin.init()
      await plugin.resetCache()
      await plugin.load()
      await this.addPlugin(name, tag)
    } catch (err) {
      await this.removePlugin(name)
      await this.yarn.exec(['remove', name])
      throw err
    }
    await this.lock.unwrite()
    cli.action.stop()
  }

  public async uninstall(name: string): Promise<void> {
    await this.init()
    await this.lock.write()
    await this.removePlugin(name)
    await this.yarn.exec(['remove', name])
    await this.lock.unwrite()
  }

  public async refresh() {
    if (!this.plugins.length) return
    if ((await this.yarnNodeVersion()) === process.version) return
    cli.action.start(`Updating plugins, node version changed to ${process.versions.node}`)
    await this.lock.write()
    await this.yarn.exec()
    for (let p of this.plugins.map(p => p.resetCache())) await p
    await this.lock.unwrite()
  }

  public async init() {
    if (this.plugins) return
    this.debug('init')
    this.manifest = new deps.PluginManifest({
      name: 'user',
      file: path.join(this.config.dataDir, 'plugins', 'user.json'),
    })
    this.lock = new deps.Lock(this.config, this.manifest.file + '.lock')
    this.yarn = new Yarn({ config: this.config, cwd: this.userPluginsDir })
    await this.lock.read()
    await this.migrate()
    this.plugins = await Promise.all(
      Object.entries(await this.manifestPlugins()).map(([k, v]) => this.loadPlugin(k, v.tag)),
    )
    if (this.plugins.length) this.debug('plugins:', this.plugins.map(p => p.name).join(', '))
    await this.refresh()
    await this.lock.unread()
  }

  private async loadPlugin(name: string, tag: string): Promise<UserPlugin> {
    const pjson = await deps.file.fetchJSONFile(path.join(this.userPluginPath(name), 'package.json'))
    let p = new UserPlugin({
      pjson,
      tag,
      root: this.userPluginPath(name),
      config: this.config,
    })
    await p.init()
    return p
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
    cli.action.start('Refreshing plugins')
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
    let plugins = await this.manifestPlugins()
    plugins[name] = { tag }
    await this.manifest.set('plugins', plugins)
    await this.manifest.save()
  }

  private async removePlugin(name: string) {
    let plugins = await this.manifestPlugins()
    delete plugins[name]
    await this.manifest.set('plugins', plugins)
    await this.manifest.save()
  }

  private async manifestPlugins(): Promise<{ [k: string]: { tag: string } }> {
    return (await this.manifest.get('plugins')) || {}
  }

  private async yarnNodeVersion(): Promise<string | undefined> {
    try {
      let f = await deps.file.readJSON(path.join(this.userPluginsDir, 'node_modules', '.yarn-integrity'))
      return f.nodeVersion
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }
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
