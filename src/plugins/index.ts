import deps from '../deps'
import { UserPlugins } from './user'
import { LinkPlugins } from './link'
import { Plugin, PluginType } from './plugin'
import { PluginManager } from './manager'

export class Plugins extends PluginManager {
  public plugins: Plugin[]
  public user: UserPlugins
  public link: LinkPlugins

  public pluginType(name: string): PluginType | undefined {
    const plugin = this.plugins.find(p => p.name === name)
    return plugin && plugin.type
  }

  public async update(): Promise<void> {
    await this.user.update()
  }

  public async uninstall(name: string): Promise<void> {
    const type = await this.pluginType(name)
    if (!type) throw new Error(`${name} is not installed`)
    await this.manifest.remove(name)
    await this.manifest.save()
    if (type === 'user') await this.user.uninstall(name)
  }

  protected async _init() {
    const submanagerOpts = { config: this.config, manifest: this.manifest }
    this.submanagers = [new deps.Builtin(submanagerOpts)]
    if (true || this.config.userPlugins) {
      this.user = new deps.UserPlugins(submanagerOpts)
      this.link = new deps.LinkPlugins(submanagerOpts)
      this.submanagers = [...this.submanagers, this.user, this.link]
    }
    await Promise.all(this.submanagers.map(m => m.init()))
    this.plugins = this.link.plugins.concat(this.user.plugins)
  }
}
