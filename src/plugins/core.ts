import { Config } from 'cli-engine-config'
import cli from 'cli-ux'
import { PluginCache } from './cache'
import { Plugin, PluginType } from './plugin'
import { PluginManager } from './manager'
import _ from 'ts-lodash'
import * as path from 'path'

const debug = require('debug')('cli:plugins:core')

export class CorePlugins extends PluginManager {
  public plugins: Plugin[]

  private cache: PluginCache

  constructor({ config, cache }: { config: Config; cache: PluginCache }) {
    super({ config })
    this.cache = cache
  }

  protected async _init() {
    debug('init')
    this.submanagers = this.plugins = await this.fetchPlugins()
  }

  private async fetchPlugins() {
    const plugins = this.config.corePlugins.map(name => this.loadPlugin(name))
    return _.compact(plugins)
  }

  private loadPlugin(name: string) {
    try {
      return new CorePlugin({
        config: this.config,
        cache: this.cache,
        root: this.root(name),
      })
    } catch (err) {
      cli.warn(err, { context: `error loading core plugin ${name} from ${this.root(name)}` })
    }
  }

  private root(name: string): string {
    return path.join(this.config.root, 'node_modules', name)
  }
}

class CorePlugin extends Plugin {
  public type: PluginType = 'core'
}
