import Config from '../config'

import { Plugin, PluginType } from './plugin'

export class MainPlugin extends Plugin {
  public type: PluginType = 'main'

  constructor(config: Config) {
    super({ config, root: config.root! })
  }

  public get commandsDir() {
    return this.config.commandsDir
  }
}
