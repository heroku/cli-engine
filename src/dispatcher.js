// @flow

import {type Config} from 'cli-engine-config'
import {default as CommandBase} from 'cli-engine-command'
import path from 'path'
import {undefault} from './util'
const debug = require('debug')('cli:dispatcher')

const builtins = {
  version: 'version'
}

export default class Dispatcher {
  config: Config
  cmd: string
  constructor (config: Config) {
    this.config = config
  }

  run (...argv: string[]) {
    let argv0 = argv.shift()
    debug('argv0: %s', argv0)
    this.cmd = argv.shift()
    let Command: ?Class<CommandBase<*>>
    Command = this.findCommand()
    if (!Command) throw new Error(`${this.cmd} command not found`)
    Command.run({config: this.config, argv})
  }

  findCommand () {
    let p = this.findCommandInCLI() || this.findCommandInBuiltins()
    if (p) {
      debug('loading command from %s', p)
      return undefault(require(p))
    }
  }

  findCommandInCLI () {
    let root = this.config.commandsDir
    try {
      if (!this.cmd) {
        debug('loading root command from %s', this.cmd)
        // TODO: make flag parsing work here somehow
        return require.resolve(root)
      } else {
        debug(`finding ${this.cmd} command`)
        return require.resolve(path.join(root, ...this.cmd.split(':')))
      }
    } catch (err) {
      if (err.code !== 'MODULE_NOT_FOUND') throw err
    }
  }

  findCommandInBuiltins () {
    let p = builtins[this.cmd]
    if (p) {
      p = path.join(__dirname, 'commands', p)
      return require.resolve(p)
    }
  }
}
