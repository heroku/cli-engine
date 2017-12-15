import { cli } from 'cli-ux'
import { UserPlugins } from './user'
import { LinkPlugins } from './link'
import { Plugin, PluginType } from './plugin'
import { PluginRepo } from './repo'
import { CommandManagerBase } from '../command_managers/base'

export class Plugins extends CommandManagerBase {
  public repo: PluginRepo
  public user: UserPlugins
  public link: LinkPlugins
  public plugins: Plugin[]

  public pluginType(name: string): PluginType | undefined {
    const plugin = this.plugins.find(p => p.name === name)
    return plugin && plugin.type
  }

  public async uninstall(name: string): Promise<void> {
    const type = await this.pluginType(name)
    if (!type) throw new Error(`${name} is not installed`)
    if (type === 'user') {
      try {
        await this.user.uninstall(name)
      } catch (err) {
        cli.warn(err)
      }
    }
    await this.repo.remove(name)
    await this.repo.save()
  }

  public async init() {
    if (this.initialized) return
    await super.init()
    this.plugins = this.link.plugins.concat(this.user.plugins)
    // .concat(this.core.plugins)
  }

  protected async _init() {
    this.repo = new PluginRepo(this.config)
    this.user = new UserPlugins({ config: this.config, repo: this.repo })
    this.link = new LinkPlugins({ config: this.config, repo: this.repo })
    this.submanagers = [this.link, this.user]
    await this.repo.init()
  }
}
