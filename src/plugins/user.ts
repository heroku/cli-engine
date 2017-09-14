import {Config} from 'cli-engine-config'
import {CLI} from 'cli-ux'
import {Plugin} from './plugin'
import {Lock} from '../lock'
import Yarn from './yarn'
import * as path from 'path'

export class UserPlugins {
  public plugins: Plugin[]
  protected config: Config
  protected cli: CLI
  private lock: Lock
  private yarn: Yarn

  constructor ({config, cli}: {config: Config, cli: CLI}) {
    this.config = config
    this.cli = cli
    this.lock = new Lock(this.config, this.cli)
    this.yarn = new Yarn({config, cli, cwd: this.userPluginsDir})
  }

  get userPluginsDir (): string { return path.join(this.config.dataDir, 'plugins') }

  public async update () {
    await this.init()
    if (this.plugins.length === 0) return
    this.cli.action.start(`${this.config.name}: Updating plugins`)
    let downgrade = await this.lock.upgrade()
    await this.yarn.exec(['upgrade'])
    await downgrade()
  }

  public async init () {
    if (this.plugins) return
    this.plugins = []
  }
}
