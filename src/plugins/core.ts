import {Config} from 'cli-engine-config'
import {CLI} from 'cli-ux'
import {Plugin} from './plugin'
import * as path from 'path'

export class CorePlugins {
  public plugins: Plugin[]
  protected config: Config
  protected cli: CLI

  constructor ({config, cli}: {config: Config, cli: CLI}) {
    this.config = config
    this.cli = cli
  }

  public async init () {
    if (this.plugins) return
    this.plugins = []
    const cli = this.config.pjson['cli-engine']
    if (cli.plugins) {
      let plugins = cli.plugins.map(p => {
        return new Plugin({
          cli: this.cli,
          config: this.config,
          type: 'core',
          root: path.join(this.config.root, 'node_modules', p)
        })
      })
      this.plugins = this.plugins.concat(plugins)
    }
  }
}
