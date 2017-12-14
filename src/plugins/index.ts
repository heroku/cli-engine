// import { CorePlugins } from './core'
import { UserPlugins } from './user'
import { Plugin, PluginTypes } from './plugin'
import { CommandManagerBase } from '../command_managers/base'
import { Config } from 'cli-engine-config'

export class Plugins extends CommandManagerBase {
  public user: UserPlugins
  // public core: CorePlugins

  constructor(config: Config) {
    super(config)
    // this.core = new CorePlugins({ config: this.config })
    this.user = new UserPlugins(this.config)
  }

  public async listPlugins(): Promise<Plugin[]> {
    await this.init()
    return this.plugins
  }

  public async hasPlugin(name: string): Promise<PluginTypes | undefined> {
    await this.init()
    const plugin = this.plugins.find(p => p.name === name)
    if (plugin) return plugin.type
  }

  private get plugins(): Plugin[] {
    return this.user.plugins
    // return this.core ? this.core.plugins.concat(this.user.plugins) : []
  }

  get submanagers(): CommandManagerBase[] {
    return this.plugins
  }

  protected async init() {
    // await this.core.init()
    await this.user.init()
    await super.init()
  }
}
