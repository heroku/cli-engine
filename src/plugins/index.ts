import { CorePlugins } from './core'
import { UserPlugins } from './user'
import { Plugin } from './plugin'
import { CommandManagerBase } from '../command_managers/base'
import { Config } from 'cli-engine-config'

export class Plugins extends CommandManagerBase {
  public user: UserPlugins
  public core: CorePlugins

  constructor(options: { config: Config }) {
    super(options)
    this.core = new CorePlugins({ config: this.config })
    this.user = new UserPlugins({ config: this.config })
  }

  public async listPlugins(): Promise<Plugin[]> {
    await this.init()
    return this.plugins
  }

  get plugins() {
    return this.core ? this.core.plugins.concat(this.user.plugins) : []
  }
  get submanagers() {
    return this.plugins
  }

  protected async init() {
    await this.core.init()
    await this.user.init()
    await super.init()
  }
}
