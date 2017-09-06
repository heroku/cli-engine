// @flow

import type {Config} from 'cli-engine-config'
import type {Command} from 'cli-engine-command'
import type Plugin from './plugins/plugin'
import path from 'path'

const debug = require('debug')('cli-engine:hooks')

export type PreRunOptions = {
  plugin: ?Plugin,
  Command: Class<Command<*>>
}

export class Hooks {
  config: Config

  constructor ({config}: {config: Config}) {
    this.config = config
  }

  async run (event: string, options: Object = {}) {
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
