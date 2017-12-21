import { IConfig } from 'cli-engine-config'
import { ICommand } from 'cli-engine-config'
import cli from 'cli-ux'
import deps from '../deps'
import { UserPlugins } from './user'
import { Builtin } from './builtin'
import { LinkPlugins } from './link'
import { CorePlugins } from './core'
import { Plugin, PluginType } from './plugin'
import { PluginManager } from './manager'
import _ from 'ts-lodash'
import * as path from 'path'
import { Lock } from '../lock'

export type InstallOptions = LinkInstallOptions | UserInstallOptions
export interface UserInstallOptions {
  type: 'user'
  name: string
  tag: string
  force?: boolean
}
export interface LinkInstallOptions {
  type: 'link'
  root: string
  force?: boolean
}

export class Plugins extends PluginManager {
  public builtin: Builtin
  public core: CorePlugins
  public user: UserPlugins
  public link: LinkPlugins
  protected debug = require('debug')('cli:plugins')
  private lock: Lock

  constructor({ config }: { config: IConfig }) {
    super({ config })
    this.lock = new deps.Lock(config, path.join(config.cacheDir, 'plugins.lock'))
  }

  public async install(options: InstallOptions) {
    let downgrade = await this.lock.upgrade()
    await this.init()
    let name = options.type === 'user' ? options.name : await this.getLinkedPackageName(options.root)
    if (!options.force && (await this.pluginType(name))) {
      throw new Error(`${name} is already installed. Run with --force to install anyway`)
    }
    if (options.type === 'link') {
      await this.link.install(options.root)
      await this.manifest.add({ type: options.type, name, root: options.root })
    } else {
      await this.user.install(name, options.tag)
      await this.manifest.add({ type: options.type, name, tag: options.tag })
    }
    await this.save()
    await downgrade()
  }

  public async update(): Promise<void> {
    let downgrade = await this.lock.upgrade()
    await this.migrate()
    await this.user.update()
    await this.save()
    await downgrade()
  }

  public async uninstall(name: string): Promise<void> {
    await this.init()
    let downgrade = await this.lock.upgrade()
    const type = await this.pluginType(name)
    if (!type) {
      const linked = await this.link.findByRoot(name)
      if (linked) {
        name = linked.name
      } else throw new Error(`${name} is not installed`)
    }
    await this.manifest.remove(name)
    await this.save()
    if (type === 'user') await this.user.uninstall(name)
    await downgrade()
  }

  public async init() {
    await super.init()
    if (await this.needsRefresh) {
      let downgrade = await this.lock.upgrade()
      cli.action.start('Refreshing plugins')
      await this.refresh()
      await this.load
      await this.save()
      cli.action.stop()
      await downgrade()
    }
    await this.load
  }

  protected async _init() {
    const submanagerOpts = { config: this.config, manifest: this.manifest, cache: this.cache, lock: this.lock }
    this.builtin = new deps.Builtin(submanagerOpts)
    this.submanagers.push(this.builtin)
    try {
      this.core = new deps.CorePlugins(submanagerOpts)
    } catch (err) {
      cli.warn(err, { context: 'core plugins' })
    }
    if (this.config.userPlugins) {
      try {
        this.user = new deps.UserPlugins(submanagerOpts)
        this.link = new deps.LinkPlugins(submanagerOpts)
      } catch (err) {
        cli.warn(err, { context: 'user/link plugins' })
      }
    }
    this.submanagers = _.compact([this.link, this.user, this.core, this.builtin])
  }

  public async findCommand(id: string, options: { must: true }): Promise<ICommand>
  public async findCommand(id: string, options?: { must?: boolean }): Promise<ICommand | undefined>
  public async findCommand(id: string, options: { must?: boolean } = {}): Promise<ICommand | undefined> {
    const cmd = await super.findCommand(id)
    if (!cmd && options.must) throw new Error(`${id} not found`)
    return cmd
  }

  public get plugins(): Plugin[] {
    const managers = _.compact([this.link, this.user, this.core])
    const plugins = managers.reduce((o, i) => o.concat(i.plugins), [] as Plugin[])
    return _.compact([...plugins, this.builtin])
  }

  private async save() {
    try {
      await this.manifest.save()
      await this.cache.save()
    } catch (err) {
      cli.warn(err)
    }
  }

  private async migrate() {
    const migrate = new deps.PluginsMigrate({
      manifest: this.manifest,
      config: this.config,
    })
    await migrate.migrate()
  }

  private async getLinkedPackageName(root: string): Promise<string> {
    const pjson = await deps.file.fetchJSONFile(path.join(root, 'package.json'))
    return pjson.name
  }

  private pluginType(name: string): PluginType | undefined {
    const plugin = this.plugins.find(p => p.name === name)
    return plugin && plugin.type
  }
}
