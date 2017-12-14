import { cli } from 'cli-ux'
// import { CorePlugins } from './core'
import { UserPlugins } from './user'
import { LinkPlugins } from './link'
import { Plugin, PluginTypes } from './plugin'
import { CommandManagerBase } from '../command_managers/base'
import { Config } from 'cli-engine-config'
import { PluginRepo } from './repo'
import { PluginManager } from './manager'

export class Plugins extends CommandManagerBase {
  public repo: PluginRepo
  public user: UserPlugins
  public link: LinkPlugins
  // public core: CorePlugins

  constructor(config: Config) {
    super(config)
    this.repo = new PluginRepo(this.config)
    let opts = { config: this.config, repo: this.repo }
    this.user = new UserPlugins(opts)
    this.link = new LinkPlugins(opts)
  }

  public async listPlugins(): Promise<Plugin[]> {
    await this.init()
    const user = await this.user.list()
    const link = await this.link.list()
    return user.concat(link)
  }

  public async hasPlugin(name: string): Promise<PluginTypes | undefined> {
    const plugins = await this.listPlugins()
    const plugin = plugins.find(p => p.name === name)
    if (plugin) return plugin.type
  }

  public async uninstall(name: string): Promise<void> {
    const type = await this.hasPlugin(name)
    if (!type) throw new Error(`${name} is not installed`)
    if (type === 'user') {
      await this.user.uninstall(name)
    }
    await this.repo.remove(name)
  }

  protected async init() {
    if (this.initialized) return
    try {
      await this.repo.init()
      let refreshNeeded = (await this.repo.nodeVersion()) !== process.versions.node
      this.user.refreshNeeded = refreshNeeded
      this.link.refreshNeeded = refreshNeeded
      await super.init()
      await this.repo.updateNodeVersion()
    } catch (err) {
      cli.warn(err, { context: 'error loading plugins' })
    }
  }

  get submanagers(): PluginManager[] {
    return [this.user, this.link]
  }
}
