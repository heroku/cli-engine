import { color } from 'heroku-cli-color'
import { ICommand } from 'cli-engine-config'
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
    await this.migrate()
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

  protected async _init() {
    try {
      this.cache = new deps.PluginCache(this.config)
    } catch (err) {
      cli.warn(err, { context: 'plugin cache' })
    }
    const submanagerOpts = { config: this.config, cache: this.cache }
    this.builtin = new deps.Builtin(submanagerOpts)
    this.submanagers.push(this.builtin)
    try {
      this.core = new deps.CorePlugins(submanagerOpts)
    } catch (err) {
      cli.warn(err, { context: 'core plugins' })
    }
    if (true || this.config.userPlugins) {
      try {
        this.manifest = new deps.PluginManifest(this.config)
        const submanagerOpts = { config: this.config, manifest: this.manifest, cache: this.cache }
        this.user = new deps.UserPlugins(submanagerOpts)
        this.link = new deps.LinkPlugins(submanagerOpts)
      } catch (err) {
        cli.warn(err, { context: 'user/link plugins' })
      }
    }
    this.submanagers = _.compact([this.link, this.user, this.core, this.builtin])
    await this.initSubmanagers()
    await this.save()
  }

  public async findCommand(id: string, options: { must: true }): Promise<ICommand>
  public async findCommand(id: string, options?: { must?: boolean }): Promise<ICommand | undefined>
  public async findCommand(id: string, options: { must?: boolean } = {}): Promise<ICommand | undefined> {
    const cmd = await super.findCommand(id)
    await this.saveCache()
    if (!cmd && options.must) throw new Error(`${id} not found`)
    return cmd
  }

  public async findCommandHelp(id: string, options: { save?: boolean } = {}): Promise<string | undefined> {
    const plugin = await this.findPluginWithCommandID(id)
    if (!plugin) return
    const fn = async () => {
      const c = await plugin.findCommand(id)
      if (!c) throw new Error('command not found')
      return c.buildHelp(this.config)
    }
    if (!this.cache) return fn()
    let help = await this.cache.fetch(plugin, `command:help:${id}`, fn)
    if (options.save || options.save === undefined) await this.saveCache()
    if (!color.supportsColor) help = deps.stripAnsi(help)
    return help
  }

  public async findCommandsHelpLines(
    ids: string[],
    options: { save?: boolean } = {},
  ): Promise<[string, string | undefined][]> {
    ids.sort()
    let help = await Promise.all(ids.map(id => this.findCommandHelpLine(id)))
    if (options.save || options.save === undefined) await this.saveCache()
    return _.compact(help)
  }

  public async warmCache() {
    cli.action.start('Warming cache')
    await this.init()
    if (!this.cache) return cli.warn('cache disabled')
    await this.topics()
    const ids = await this.commandIDs()
    await this.findCommandsHelpLines(ids, { save: false })
    for (let p of ids.map(id => this.findCommandHelp(id, { save: false }))) await p
    await this.cache.save()
    cli.action.stop()
  }

  private async findCommandHelpLine(id: string): Promise<[string, string | undefined] | null> {
    const plugin = await this.findPluginWithCommandID(id)
    if (!plugin) throw new Error(`command ${id} not found`)
    const fn = async () => {
      const c = await plugin.findCommand(id)
      if (!c) throw new Error('command not found')
      if (c.hidden) return null
      return c.buildHelpLine(this.config)
    }
    if (!this.cache) return fn()
    return this.cache.fetch(plugin, `command:helpline:${id}`, fn)
  }

  private async findPluginWithCommandID(id: string): Promise<Plugin | undefined> {
    const plugins = await this.plugins()
    for (let p of plugins) {
      const ids = await p.commandIDs()
      if (ids.includes(id)) return p
    }
  }

  public async findCommands(ids: string[]): Promise<ICommand[]> {
    return Promise.all(ids.map(id => this.findCommand(id, { must: true })))
  }

  public async plugins(): Promise<Plugin[]> {
    await this.init()
    const managers = _.compact([this.link, this.user, this.core])
    const plugins = managers.reduce((o, i) => o.concat(i.plugins), [] as Plugin[])
    return [...plugins, this.builtin]
  }

  public async saveCache() {
    try {
      if (this.cache) this.cache.save()
    } catch (err) {
      cli.warn(err)
    }
  }

  public async saveManifest() {
    try {
      if (this.manifest) this.manifest.save()
    } catch (err) {
      cli.warn(err)
    }
  }

  public async save() {
    await this.saveCache()
    await this.saveManifest()
  }

  private async migrate() {
    if (this.user && this.link && this.manifest) {
      const migrate = new deps.PluginsMigrate({
        user: this.user,
        link: this.link,
        config: this.config,
        manifest: this.manifest,
      })
      await migrate.migrate()
      await this.save()
    }
  }
}
