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
    let commandsDir = this.config.commandsDir
    let argv0 = argv.shift()
    debug('argv0: %s', argv0)
    let commandID = argv.shift()
    let Command: ?Class<CommandBase<*>>
    if (!commandID) {
      debug('loading root command from %s', commandsDir)
      // TODO: make flag parsing work here somehow
      Command = require(commandsDir)
    } else {
      debug(`finding ${commandID} command`)
    }
    if (!Command) throw new Error(`${commandID} command not found`)
    Command.run({config: this.config})
  }
}
