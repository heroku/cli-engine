import cli from 'cli-ux'
import { Config } from 'cli-engine-config'
import { Plugin } from './plugin'
import { PluginRepo } from './repo'
import Yarn from './yarn'
import * as path from 'path'
import * as fs from 'fs-extra'
import { PluginManager } from './manager'

export class UserPlugins extends PluginManager {
  public plugins: Plugin[]
  protected config: Config
  private yarn: Yarn

  constructor({ config, repo }: { config: Config; repo: PluginRepo }) {
    super({ config, repo })
    this.yarn = new Yarn({ config, cwd: this.userPluginsDir })
  }

  public async update() {
    await this.init()
    if (this.plugins.length === 0) return
    cli.action.start(`${this.config.name}: Updating plugins`)
    let downgrade = await this.lock.upgrade()
    await this.yarn.exec(['upgrade'])
    await downgrade()
  }

  public async install(name: string, tag: string): Promise<void> {
    await this.init()
    let downgrade = await this.lock.upgrade()
    await this.yarn.exec(['add', `${name}@${tag}`])
    const plugin = this.loadPlugin(name, tag)
    await plugin.validate()
    await this.repo.add({ type: 'user', name, tag })
    await downgrade()
  }

  public async uninstall(name: string): Promise<void> {
    await this.init()
    await this.yarn.exec(['remove', name])
    await this.repo.remove(name)
  }

  public async init() {
    await this.setupUserPlugins()
    await super.init()
  }

  protected async fetchPlugins() {
    if (this.refreshNeeded) await this.refreshPlugins()
    const p = await this.repo.list('user')
    return p.map(p => this.loadPlugin(p.name, p.tag))
  }

  private get userPluginsDir(): string {
    return path.join(this.config.dataDir, 'plugins')
  }

  private loadPlugin(name: string, tag: string) {
    return new Plugin({
      config: this.config,
      type: 'user',
      root: this.userPluginPath(name),
      tag,
    })
  }

  private async refreshPlugins() {
    await this.yarn.exec()
  }

  private userPluginPath(name: string): string {
    return path.join(this.userPluginsDir, 'node_modules', name)
  }

  private get pjsonPath() {
    return path.join(this.userPluginsDir, 'package.json')
  }

  private async setupUserPlugins() {
    if (!fs.existsSync(this.pjsonPath)) {
      await fs.outputJSON(this.pjsonPath, { private: true }, { spaces: 2 })
    }
  }
}
