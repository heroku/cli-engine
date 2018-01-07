import * as path from 'path'

import Config from '../config'

import { Plugin } from './plugin'

export class Builtin extends Plugin {
  constructor(config: Config) {
    const root = path.join(__dirname, '../..')
    super({ config, type: 'builtin', root })
  }

  protected async commandIDsFromDir(): Promise<string[]> {
    const ids = ['commands', 'help', 'update', 'version', 'which']
    if (!this.config.userPluginsEnabled) return ids
    return [...ids, 'plugins', 'plugins:install', 'plugins:link', 'plugins:uninstall', 'plugins:update']
  }
}
