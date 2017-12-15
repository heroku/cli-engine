import deps from '../deps'
import cli from 'cli-ux'
import { Config } from 'cli-engine-config'
import { Plugin, PluginType } from './plugin'
import Yarn from './yarn'
import * as path from 'path'
import { Lock } from '../lock'
import { PluginManager } from './manager'
import { PluginManifest } from './manifest'

const debug = require('debug')('cli:plugins:user')

export class UserPlugins extends PluginManager {
  public plugins: Plugin[]
  protected config: Config
  protected lock: Lock

  private pjsonPath: string
  private yarn: Yarn
  private manifest: PluginManifest

  constructor({ config, manifest }: { config: Config; manifest: PluginManifest }) {
    super({ config })
    this.manifest = manifest
  }

  public async update() {
    if (this.plugins.length === 0) return
    cli.action.start(`${this.config.name}: Updating plugins`)
    let downgrade = await this.lock.upgrade()
    const packages = this.manifest.list('user').map(p => `${p.name}@${p.tag}`)
    await this.yarn.exec(['upgrade', ...packages])
    await downgrade()
  }

  public async install(name: string, tag: string): Promise<void> {
    let downgrade = await this.lock.upgrade()
    await this.yarn.exec(['add', `${name}@${tag}`])
    const plugin = this.loadPlugin(name, tag)
    await plugin.init()
    await plugin.validate()
    await this.manifest.add({ type: 'user', name, tag })
    await this.manifest.save()
    await downgrade()
  }

  public async uninstall(name: string): Promise<void> {
    await this.yarn.exec(['remove', name])
    await this.manifest.remove(name)
  }

  protected async _init() {
    debug('_init')
    await this.manifest.init()
    this.lock = new deps.Lock(this.config, path.join(this.userPluginsDir, 'plugins.lock'))
    this.pjsonPath = path.join(this.userPluginsDir, 'package.json')
    this.yarn = new Yarn({ config: this.config, cwd: this.userPluginsDir })
    await this.refresh()
    this.submanagers = this.plugins = this.fetchPlugins()
  }

  private async refresh() {
    await this.createPJSON()
    if (this.manifest.nodeVersionChanged) {
      await this.yarn.exec()
    }
  }

  protected fetchPlugins() {
    const defs = this.manifest.list('user')
    return defs.map(p => this.loadPlugin(p.name, p.tag))
  }

  private loadPlugin(name: string, tag: string) {
    return new UserPlugin({
      config: this.config,
      root: this.userPluginPath(name),
      lock: this.lock,
      tag,
    })
  }

  private userPluginPath(name: string): string {
    return path.join(this.userPluginsDir, 'node_modules', name)
  }

  private async createPJSON() {
    if (!await deps.file.exists(this.pjsonPath)) {
      await deps.file.outputJSON(this.pjsonPath, { private: true }, { spaces: 2 })
    }
  }
}

export class UserPlugin extends Plugin {
  public type: PluginType = 'user'
}
