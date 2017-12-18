import deps from '../deps'
import cli from 'cli-ux'
import { Config } from 'cli-engine-config'
import { Plugin, PluginType, PluginOptions } from './plugin'
import Yarn from './yarn'
import * as path from 'path'
import { Lock } from '../lock'
import { PluginManager } from './manager'
import { PluginCache } from './cache'
import { PluginManifest } from './manifest'

export class UserPlugins extends PluginManager {
  public plugins: UserPlugin[]
  protected config: Config
  protected cache?: PluginCache
  protected lock: Lock

  private yarn: Yarn
  private manifest: PluginManifest

  constructor({ config, manifest, cache }: { config: Config; manifest: PluginManifest; cache?: PluginCache }) {
    super({ config })
    this.manifest = manifest
    this.cache = cache
  }

  public async update() {
    if (this.plugins.length === 0) return
    cli.action.start(`${this.config.name}: Updating plugins`)
    let downgrade = await this.lock.upgrade()
    const packages = (await this.manifest.list('user')).map(p => `${p.name}@${p.tag}`)
    await this.yarn.exec(['upgrade', ...packages])
    await downgrade()
  }

  public async install(name: string, tag: string): Promise<void> {
    let downgrade = await this.lock.upgrade()
    await this.yarn.exec(['add', `${name}@${tag}`])
    const plugin = this.loadPlugin(name, tag)
    await plugin.init()
    await this.manifest.add({ type: 'user', name, tag })
    await this.manifest.save()
    await downgrade()
  }

  public async uninstall(name: string): Promise<void> {
    await this.yarn.exec(['remove', name])
    await this.manifest.remove(name)
  }

  protected async _init() {
    this.debug('init')
    this.lock = new deps.Lock(this.config, path.join(this.userPluginsDir, 'plugins.lock'))
    this.yarn = new Yarn({ config: this.config, cwd: this.userPluginsDir })
    await this.refresh()
    const defs = await this.manifest.list('user')
    this.submanagers = this.plugins = defs.map(p => this.loadPlugin(p.name, p.tag))
  }

  private async refresh() {
    await this.createPJSON()
    if (this.manifest.nodeVersionChanged) {
      const downgrade = await this.lock.upgrade()
      await this.yarn.exec()
      await downgrade()
    }
  }

  private loadPlugin(name: string, tag: string) {
    return new UserPlugin({
      config: this.config,
      cache: this.cache,
      root: this.userPluginPath(name),
      lock: this.lock,
      tag,
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

  private async createPJSON() {
    if (!await deps.file.exists(this.pjsonPath)) {
      await deps.file.outputJSON(this.pjsonPath, { private: true, 'cli-engine': { schema: 1 } }, { spaces: 2 })
    }
  }
}

export type UserPluginOptions = PluginOptions & {
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
