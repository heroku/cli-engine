import * as path from 'path'
import deps from '../deps'
import { PluginManager } from './manager'
import { IPluginPJSON, Plugin, PluginOptions, PluginType } from './plugin'

export class CorePlugins extends PluginManager {
  public plugins: CorePlugin[]

  protected async _init() {
    this.plugins = this.submanagers = await Promise.all(this.config.corePlugins.map(name => this.initPlugin(name)))
  }

  private async initPlugin(name: string) {
    return new CorePlugin({
      cache: this.cache,
      config: this.config,
      manifest: this.manifest,
      pjson: await this.pjson(name),
      root: this.root(name),
    })
  }

  private pjson(name: string): Promise<IPluginPJSON> {
    return deps.file.fetchJSONFile(path.join(this.root(name), 'package.json'))
  }

  private root(name: string): string {
    return path.join(this.config.root, 'node_modules', name)
  }
}

export class CorePlugin extends Plugin {
  public type: PluginType = 'core'
  public pjson: IPluginPJSON

  constructor(options: PluginOptions & { pjson: IPluginPJSON }) {
    super(options)
  }
}
