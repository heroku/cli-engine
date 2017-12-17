import {ICommand} from 'cli-engine-config'
import cli from 'cli-ux'
import deps from '../deps'
import { UserPlugins } from './user'
import { Builtin } from './builtin'
import { LinkPlugins } from './link'
import { PluginManifest } from './manifest'
import { CorePlugins } from './core'
import { Plugin, PluginType } from './plugin'
import { PluginManager } from './manager'
import { PluginCache } from './cache'
import _ from 'ts-lodash'

export class Plugins extends PluginManager {
  public builtin: Builtin
  public core: CorePlugins
  public user: UserPlugins
  public link: LinkPlugins
  protected debug = require('debug')('cli:plugins')
  private manifest?: PluginManifest
  private cache?: PluginCache

  public async pluginType(name: string): Promise<PluginType | undefined> {
    const plugins = await this.plugins()
    const plugin = plugins.find(p => p.name === name)
    return plugin && plugin.type
  }

  public async update(): Promise<void> {
    await this.init()
    await this.user.update()
  }

  public async uninstall(name: string): Promise<void> {
    await this.init()
    if (!this.manifest) throw new Error('no manifest')
    const type = await this.pluginType(name)
    if (!type) {
      const linked = await this.link.findByRoot(name)
      if (linked) {
        name = linked.name
      } else throw new Error(`${name} is not installed`)
    }
    await this.manifest.remove(name)
    await this.manifest.save()
    if (type === 'user') await this.user.uninstall(name)
  }

  // public async init() {
  //   await super.init()
  //   await this.saveManifest()
  //   await this.saveCache()
  //   this.plugins = [...this.core.plugins, ...this.user.plugins, ...this.link.plugins]
  // }

  protected async _init() {
    try {
      this.cache = new deps.PluginCache(this.config)
    } catch (err) {
      cli.warn(err, {context: 'plugin cache'})
    }
    const submanagerOpts = { config: this.config, cache: this.cache }
    this.builtin = new deps.Builtin(submanagerOpts)
    this.submanagers.push(this.builtin)
    try {
      this.core = new deps.CorePlugins(submanagerOpts)
    } catch (err) {
      cli.warn(err, {context: 'core plugins'})
    }
    if (true || this.config.userPlugins) {
      try {
        this.manifest = new deps.PluginManifest(this.config)
        const submanagerOpts = { config: this.config, manifest: this.manifest, cache: this.cache }
        this.user = new deps.UserPlugins(submanagerOpts)
        this.link = new deps.LinkPlugins(submanagerOpts)
      } catch (err) {
        cli.warn(err, {context: 'user/link plugins'})
      }
    }
    this.submanagers = _.compact([this.link, this.user, this.core, this.builtin])
  }

  public async findCommand(id: string, options: {must: true}): Promise<ICommand>
  public async findCommand(id: string, options?: {must?: boolean}): Promise<ICommand | undefined>
  public async findCommand(id: string, options: {must?: boolean} = {}): Promise<ICommand | undefined> {
    const cmd = await super.findCommand(id)
    if (!cmd && options.must) throw new Error(`${id} not found`)
    return cmd
  }

  public async findCommands(ids: string[]): Promise<ICommand[]> {
    return Promise.all(ids.map(id => this.findCommand(id, {must: true})))
  }

  public async plugins (): Promise<Plugin[]> {
    await this.init()
    const managers = _.compact([this.link, this.user, this.core])
    return managers.reduce((o, i) => o.concat(i.plugins), [] as Plugin[])
  }

  // private async saveManifest() {
  //   try {
  //     if (!this.manifest) return
  //     await this.manifest.save()
  //   } catch (err) {
  //     cli.warn(err)
  //   }
  // }

  // private async saveCache() {
  //   try {
  //     await this.cache.save()
  //   } catch (err) {
  //     cli.warn(err)
  //   }
  // }
}
