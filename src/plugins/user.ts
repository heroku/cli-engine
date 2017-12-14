import cli from 'cli-ux'
import { Config } from 'cli-engine-config'
import { Plugin } from './plugin'
import { Lock } from '../lock'
import { PluginRepo } from './repo'
import Yarn from './yarn'
import * as path from 'path'
import * as fs from 'fs-extra'
import { CommandManagerBase } from '../command_managers/base'

export class UserPlugins extends CommandManagerBase {
  public plugins: Plugin[]
  protected config: Config
  private lock: Lock
  private yarn: Yarn
  private repo: PluginRepo

  constructor(config: Config) {
    super(config)
    this.lock = new Lock(this.config)
    this.yarn = new Yarn({ config, cwd: this.userPluginsDir })
    this.repo = new PluginRepo(config)
  }

  get userPluginsDir(): string {
    return path.join(this.config.dataDir, 'plugins')
  }

  public async update() {
    await this.init()
    if (this.plugins.length === 0) return
    cli.action.start(`${this.config.name}: Updating plugins`)
    let downgrade = await this.lock.upgrade()
    await this.yarn.exec(['upgrade'])
    await downgrade()
  }

  public async list(): Promise<Plugin[]> {
    await this.init()
    return this.plugins
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

  public async init() {
    await this.setupUserPlugins()
    if (this.plugins) return
    this.plugins = (await this.repo.list('user')).map(p => this.loadPlugin(p.name, p.tag))
  }

  private loadPlugin(name: string, tag: string) {
    return new Plugin({
      config: this.config,
      type: 'user',
      root: this.userPluginPath(name),
      tag,
    })
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
