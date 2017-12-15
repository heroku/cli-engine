import cli from 'cli-ux'
import { Config } from 'cli-engine-config'
import { Plugin } from './plugin'
import { PluginManager } from './manager'
import _ from 'ts-lodash'
import * as path from 'path'

export class CorePlugins extends PluginManager {
  public plugins: Plugin[]
  protected config: Config

  protected async _init() {
    this.submanagers = this.plugins = await this.fetchPlugins()
  }

  protected async fetchPlugins() {
    const plugins = this.config.corePlugins.map(name => this.loadPlugin(name))
    return _.compact(plugins)
  }

  private loadPlugin(name: string) {
    try {
      return new Plugin({
        config: this.config,
        type: 'core',
        root: this.root(name),
      })
    } catch (err) {
      cli.warn(err, { context: `error loading core plugin ${name} from ${this.root(name)}` })
    }
  }

  private root(name: string): string {
    // @ts-ignore
    return path.join(this.config.root, 'node_modules', name)
  }
}
