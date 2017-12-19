import { Plugin, PluginType } from './plugin'
import { PluginManager } from './manager'
import * as path from 'path'

export class CorePlugins extends PluginManager {
  public plugins: CorePlugin[]

  protected async _init() {
    this.plugins = this.submanagers = this.config.corePlugins.map(name => this.initPlugin(name))
  }

  private initPlugin(name: string) {
    return new CorePlugin({
      name,
      config: this.config,
      cache: this.cache,
      root: this.root(name),
    })
  }

  private root(name: string): string {
    return path.join(this.config.root, 'node_modules', name)
  }
}

export class CorePlugin extends Plugin {
  public type: PluginType = 'core'
}
