import * as path from 'path'

import Config from '../config'

import { IPluginPJSON, Plugin, PluginType } from './plugin'

export class CorePlugins {
  public plugins: CorePlugin[]

  constructor(private config: Config) {}

  public async submanagers(): Promise<CorePlugin[]> {
    await this.init()
    return this.plugins
  }

  public async init(): Promise<void> {
    if (this.plugins || !this.config.root) return
    this.plugins = this.config.corePlugins.map(name => {
      const pjsonPath = require.resolve(`${name}/package.json`)
      return new CorePlugin({
        pjson: require(pjsonPath),
        root: path.dirname(pjsonPath),
        config: this.config,
        type: 'core',
      })
    })
  }
}

export class CorePlugin extends Plugin {
  public type: PluginType = 'core'
  public pjson: IPluginPJSON
}
