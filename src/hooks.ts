import { Config, ICommand } from 'cli-engine-config'
import * as path from 'path'
import { Plugin } from './plugins/plugin'

const debug = require('debug')('cli-engine:hooks')

export type PluginsParseOptions = {
  module: any
  plugin: Plugin
}

export type PreRunOptions = {
  command: ICommand
  argv: string[]
}

export class Hooks {
  config: Config

  constructor({ config }: { config: Config }) {
    this.config = config
  }

  async run(event: 'plugins:parse', options: PluginsParseOptions): Promise<void>
  async run(event: 'prerun', options: PreRunOptions): Promise<void>
  async run(event: string): Promise<void>
  async run(event: string, options: { [k: string]: any } = {}): Promise<void> {
    let scripts = this.config.hooks[event]
    if (!scripts) return
    for (let script of scripts) {
      script = path.join(this.config.root, script)
      debug(`%s %s`, event, script)
      const m = require(script)
      await m(this.config, options)
    }
  }
}
