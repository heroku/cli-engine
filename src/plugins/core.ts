import { IConfig } from 'cli-engine-config'
import * as path from 'path'
import { IPluginPJSON, Plugin, PluginType } from './plugin'

export class CorePlugins {
  public plugins: CorePlugin[]

  constructor(private config: IConfig) {}

  public async submanagers() {
    await this.init()
    return this.plugins
  }

  public init() {
    if (this.plugins) return
    return this.config.corePlugins.map(
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
