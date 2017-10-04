import { Config } from 'cli-engine-config'
import { Plugin } from './plugin'
import * as path from 'path'

export class CorePlugins {
  public plugins: Plugin[]
  protected config: Config

  constructor({ config }: { config: Config }) {
    this.config = config
  }

  public async list(): Promise<Plugin[]> {
    await this.init()
    return this.plugins
  }

  public async init() {
    if (this.plugins) return
    this.plugins = []
    const cli = this.config.pjson['cli-engine']
    if (cli.plugins) {
      let plugins = cli.plugins.map(p => {
        return new Plugin({
          config: this.config,
          type: 'core',
          root: path.join(this.config.root, 'node_modules', p),
        })
      })
      this.plugins = this.plugins.concat(plugins)
    }
  }
}
