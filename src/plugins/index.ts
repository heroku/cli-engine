// import { CorePlugins } from './core'
import { UserPlugins } from './user'
import { LinkPlugins } from './link'
import { Plugin, PluginTypes } from './plugin'
import { CommandManagerBase } from '../command_managers/base'
import { Config } from 'cli-engine-config'

export class Plugins extends CommandManagerBase {
  public user: UserPlugins
  public link: LinkPlugins
  // public core: CorePlugins

  constructor(config: Config) {
    super(config)
    // this.core = new CorePlugins({ config: this.config })
    this.user = new UserPlugins(this.config)
    this.link = new LinkPlugins(this.config)
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
    return this.user.plugins.concat(this.link.plugins)
  }

  get submanagers(): CommandManagerBase[] {
    return [this.user, this.link]
  }
}
