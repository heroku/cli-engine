import deps from '../deps'
import { UserPlugins } from './user'
import { Builtin } from './builtin'
import { LinkPlugins } from './link'
import { CorePlugins } from './core'
import { Plugin, PluginType } from './plugin'
import { PluginManager } from './manager'
import * as path from 'path'

export class Plugins extends PluginManager {
  public plugins: Plugin[]
  public builtin: Builtin
  public core: CorePlugins
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
    if (!type) {
      const root = path.resolve(name)
      const linked = this.link.plugins.find(p => path.resolve(p.root) === root)
      if (linked) {
        name = linked.name
      } else throw new Error(`${name} is not installed`)
    }
    let downgrade = await this.lock.upgrade()
    await this.manifest.remove(name)
    await this.manifest.save()
    if (type === 'user') await this.user.uninstall(name)
    await downgrade()
  }

  protected async _init() {
    const submanagerOpts = { config: this.config, manifest: this.manifest }
    this.builtin = new deps.Builtin(submanagerOpts)
    this.core = new deps.CorePlugins(submanagerOpts)
    this.submanagers = [this.builtin, this.core]
    if (true || this.config.userPlugins) {
      this.user = new deps.UserPlugins(submanagerOpts)
      this.link = new deps.LinkPlugins(submanagerOpts)
      this.submanagers = [...this.submanagers, this.user, this.link]
    }
    await Promise.all(this.submanagers.map(m => m.init()))
    await this.manifest.save()
    this.plugins = this.link.plugins.concat(this.user.plugins).concat(this.core.plugins)
  }
}
