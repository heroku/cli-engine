import { IConfig } from 'cli-engine-config'
import * as path from 'path'
import { IPluginPJSON, Plugin, PluginType } from './plugin'

export class CorePlugins {
  public plugins: CorePlugin[]

  constructor(private config: IConfig) {}

  public async submanagers(): Promise<CorePlugin[]> {
    await this.init()
    return this.plugins
  }

  public async init(): Promise<void> {
    if (this.plugins) return
    this.plugins = this.config.corePlugins.map(
      name =>
        new CorePlugin({
          root: path.join(this.config.root, 'node_modules', name),
          config: this.config,
        }),
    )
  }
}

export class CorePlugin extends Plugin {
  public type: PluginType = 'core'
  public pjson: IPluginPJSON
}
