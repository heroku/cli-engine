import {CorePlugins} from './core'
import {UserPlugins} from './user'
import {Plugin} from './plugin'
import {CLI} from 'cli-ux'
import {CommandManagerBase} from '../command_managers/base'
import {Config} from 'cli-engine-config'

export class Plugins extends CommandManagerBase {
  public user: UserPlugins
  public core: CorePlugins
  protected plugins: Plugin[]

  constructor (options: {config: Config, cli?: CLI}) {
    super(options)
    this.core = new CorePlugins({config: this.config, cli: this.cli})
    this.user = new UserPlugins({config: this.config, cli: this.cli})
  }

  public async listPlugins (): Promise<Plugin[]> {
    await this.init()
    return this.plugins
  }

  protected async init () {
    if (this.plugins) return
    await Promise.all([this.core.init(), this.user.init()])
    this.plugins = []
    this.plugins = this.plugins.concat(this.core.plugins)
    this.plugins = this.plugins.concat(this.user.plugins)
    this.submanagers = this.submanagers.concat(this.plugins)
    await super.init()
  }
}
