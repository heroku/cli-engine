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
      let pjsonPath = this.pjsonPath(name)
      return new CorePlugin({
        pjson: require(pjsonPath),
        root: path.dirname(pjsonPath),
        config: this.config,
        type: 'core',
      })
    })
  }

  private pjsonPath(name: string): string {
    for (let root of this.nextRoot()) {
      try {
        return require.resolve(path.join(root, 'node_modules', name, 'package.json'))
      } catch (err) {
        if (err.code === 'MODULE_NOT_FOUND') continue
        throw err
      }
    }
    return require.resolve(path.join(this.config.root!, 'node_modules', name, 'package.json'))
  }

  private *nextRoot() {
    let root = this.config.root!
    yield root
    while (root !== '/') {
      yield (root = path.dirname(root))
    }
  }
}

export class CorePlugin extends Plugin {
  public type: PluginType = 'core'
  public pjson: IPluginPJSON
}
