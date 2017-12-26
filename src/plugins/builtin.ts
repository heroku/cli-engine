import { Config } from '@cli-engine/config'
import * as path from 'path'

import { Plugin, PluginType } from './plugin'

export class Builtin extends Plugin {
  public type: PluginType = 'builtin'

  constructor(config: Config) {
    super({ config, root: path.join(__dirname, '..', '..') })
  }

  public get commandsDir() {
    return path.join(__dirname, '..', 'commands')
  }

  protected async commandIDsFromDir(): Promise<string[]> {
    const ids = ['commands', 'help', 'update', 'version', 'which']
    if (!this.config.userPluginsEnabled) return ids
    return [...ids, 'plugins', 'plugins:install', 'plugins:link', 'plugins:uninstall', 'plugins:update']
  }
}
