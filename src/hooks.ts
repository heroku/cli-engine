import deps from './deps'
import { PluginModule, PluginPJSON } from './plugins/plugin'
import { Config, ICommand } from 'cli-engine-config'
import * as path from 'path'

const debug = require('debug')('cli:hooks')

export type PreRunOptions = {
  Command: ICommand
  argv: string[]
}

export type PluginsParseHookOptions = {
  module: PluginModule
  pjson: PluginPJSON
}

export class Hooks {
  config: Config

  constructor(config: Config) {
    this.config = config
  }

  async run(event: 'init'): Promise<void>
  async run(event: 'update'): Promise<void>
  async run(event: 'prerun', options: PreRunOptions): Promise<void>
  async run(event: 'plugins:parse', options: PluginsParseHookOptions): Promise<void>
  async run(event: string, options: Object = {}): Promise<void> {
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
