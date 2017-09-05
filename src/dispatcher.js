// @flow

import {type Config} from 'cli-engine-config'
import {type Command} from 'cli-engine-command'
import path from 'path'
import {undefault} from './util'
const debug = require('debug')('cli:dispatcher')

class CommandManagerBase {
  config: Config
  constructor (config: Config) {
    this.config = config
  }
  findCommand (cmd: string): ?Class<Command<*>> {
    return null
  }
}

class BuiltinCommandManager extends CommandManagerBase {
  findCommand (cmd) {
    const builtins = {
      version: 'version',
      help: 'help'
    }

    let p = builtins[cmd]
    if (p) {
      p = path.join(__dirname, 'commands', p)
      return require(p)
    }
  }
}

class CLICommandManager extends CommandManagerBase {
  findCommand (cmd) {
    let root = this.config.commandsDir
    let p
    try {
      debug(`finding ${cmd} command`)
      p = require.resolve(path.join(root, ...cmd.split(':')))
    } catch (err) {
      if (err.code !== 'MODULE_NOT_FOUND') throw err
    }
    if (p) return require(p)
  }
}

export default class Dispatcher {
  config: Config
  cmd: string
  managers: CommandManagerBase[]
  constructor (config: Config) {
    this.config = config
    this.managers = [
      new BuiltinCommandManager(config),
      new CLICommandManager(config)
    ]
  }

  run (...argv: string[]) {
    let argv0 = argv.shift()
    debug('argv0: %s', argv0)
    this.cmd = argv.shift()
    let command = this.findCommand()
    if (!command) throw new Error(`${this.cmd} command not found`)
    return command.run({config: this.config, argv})
  }

  findCommand () {
    for (let manager of this.managers) {
      let command = manager.findCommand(this.cmd)
      if (command) return undefault(command)
    }
  }
}
