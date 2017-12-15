import cli from 'cli-ux'
import deps from '../deps'
import { UserPlugins } from './user'
import { Builtin } from './builtin'
import { LinkPlugins } from './link'
import { PluginManifest } from './manifest'
import { CorePlugins } from './core'
import { Plugin, PluginType } from './plugin'
import { PluginManager } from './manager'
import * as path from 'path'

const debug = require('debug')('cli:plugins')

export class Plugins extends PluginManager {
  public plugins: Plugin[]
  public builtin: Builtin
  public core: CorePlugins
  public user: UserPlugins
  public link: LinkPlugins

  private manifest?: PluginManifest

  public pluginType(name: string): PluginType | undefined {
    const plugin = this.plugins.find(p => p.name === name)
    return plugin && plugin.type
  }

  public async update(): Promise<void> {
    await this.user.update()
  }

  public async uninstall(name: string): Promise<void> {
    if (!this.manifest) throw new Error('no manifest')
    const type = await this.pluginType(name)
    if (!type) {
      const root = path.resolve(name)
      const linked = this.link.plugins.find(p => path.resolve(p.root) === root)
      if (linked) {
        name = linked.name
      } else throw new Error(`${name} is not installed`)
    }
    await this.manifest.remove(name)
    await this.manifest.save()
    if (type === 'user') await this.user.uninstall(name)
  }

  protected async _init() {
    const submanagerOpts = { config: this.config }
    this.builtin = new deps.Builtin(submanagerOpts)
    this.core = new deps.CorePlugins(submanagerOpts)
    this.submanagers = [this.core, this.builtin]
    if (true || this.config.userPlugins) {
      try {
        this.manifest = new deps.PluginManifest(this.config)
        const submanagerOpts = { config: this.config, manifest: this.manifest }
        this.user = new deps.UserPlugins(submanagerOpts)
        this.link = new deps.LinkPlugins(submanagerOpts)
        this.submanagers = [this.link, this.user, this.core, this.builtin]
      } catch (err) {
        cli.warn(err)
        debug('failed to load user/link managers')
      }
    }
    await this.initSubmanagers()
    if (this.manifest) await this.manifest.save()
    this.plugins = [...this.core.plugins, ...this.user.plugins, ...this.link.plugins]
  }
}
