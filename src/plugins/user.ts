import deps from '../deps'
import cli from 'cli-ux'
import { Plugin, PluginType, PluginOptions } from './plugin'
import Yarn from './yarn'
import * as path from 'path'
import { PluginManager } from './manager'

export class UserPlugins extends PluginManager {
  public plugins: UserPlugin[]
  private yarn: Yarn

  public async update() {
    if (this.plugins.length === 0) return
    cli.action.start(`${this.config.name}: Updating plugins`)
    const packages = (await this.manifest.list('user')).map(p => `${p.name}@${p.tag}`)
    await this.yarn.exec(['upgrade', ...packages])
  }

  public async install(name: string, tag: string): Promise<void> {
    await this.yarn.exec(['add', `${name}@${tag}`])
    const plugin = await this.loadPlugin(name, tag)
    await plugin.init()
  }

  public async uninstall(name: string): Promise<void> {
    await this.yarn.exec(['remove', name])
    await this.manifest.remove(name)
  }

  protected async _needsRefresh() {
    if (this.manifest.nodeVersionChanged) return true
    return super._needsRefresh()
  }

  protected async _refresh() {
    await this.yarn.exec()
    for (let p of this.plugins.map(p => p.refresh())) await p
  }

  protected async _init() {
    this.debug('init')
    this.yarn = new Yarn({ config: this.config, cwd: this.userPluginsDir })
    await this.createPJSON()
    const defs = await this.manifest.list('user')
    this.submanagers = this.plugins = await Promise.all(defs.map(p => this.loadPlugin(p.name, p.tag)))
  }

  private async loadPlugin(name: string, tag: string): Promise<UserPlugin> {
    const pjson = await deps.file.fetchJSONFile(path.join(this.userPluginPath(name), 'package.json'))
    return new UserPlugin({
      name,
      tag,
      type: 'user',
      root: this.userPluginPath(name),
      config: this.config,
      cache: this.cache,
      version: pjson.version,
      manifest: this.manifest,
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
