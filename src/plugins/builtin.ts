import * as path from 'path'

import Config from '../config'

import { Plugin } from './plugin'

export class Builtin extends Plugin {
  constructor(config: Config) {
    const root = path.join(__dirname, '../..')
    const pjson = require(path.join(root, 'package.json'))
    super({ config, type: 'builtin', root, pjson })
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
