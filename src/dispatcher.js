// @flow

import {type Config} from 'cli-engine-config'
import {default as CommandBase} from 'cli-engine-command'
import path from 'path'
const debug = require('debug')('cli:dispatcher')

export default class Dispatcher {
  config: Config
  constructor (config: Config) {
    this.config = config
  }

  run (...argv: string[]) {
    let dir = this.config.commandsDir
    let argv0 = argv.shift()
    debug('argv0: %s', argv0)
    let commandID = argv.shift()
    let Command: ?Class<CommandBase<*>>
    let p
    try {
      if (!commandID) {
        debug('loading root command from %s', dir)
        // TODO: make flag parsing work here somehow
        p = require.resolve(dir)
      } else {
        debug(`finding ${commandID} command`)
        p = require.resolve(path.join(dir, ...commandID.split(':')))
      }
    } catch (err) {
      if (err.code !== 'MODULE_NOT_FOUND') throw err
    }
    if (!p) throw new Error(`${commandID} command not found`)
    debug('loading command from %s', p)
    Command = require(p)
    Command.run({config: this.config, argv})
  }
}
