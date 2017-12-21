import { ICommand, IConfig } from 'cli-engine-config'
import * as path from 'path'
import deps from './deps'
import { IPluginModule, IPluginPJSON } from './plugins/plugin'

const debug = require('debug')('cli:hooks')

export interface IPreRunOptions {
  Command: ICommand
  argv: string[]
}

export interface IPluginsParseHookOptions {
  module: IPluginModule
  pjson: IPluginPJSON
}

export class Hooks {
  config: IConfig

  constructor(config: IConfig) {
    this.config = config
  }

  async run(event: 'init' | 'update'): Promise<void>
  async run(event: 'prerun', options: IPreRunOptions): Promise<void>
  async run(event: 'plugins:parse', options: IPluginsParseHookOptions): Promise<void>
  async run(event: string, options: any = {}): Promise<void> {
    let scripts = this.config.hooks[event]
    if (!scripts) return
    for (let script of scripts) {
      script = path.join(this.config.root, script)
      debug(`%s %s`, event, script)
      const m = deps.util.undefault(require(script))
      await m(this.config, options)
    }
  }
}
