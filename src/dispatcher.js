// @flow

import {type Config} from 'cli-engine-config'
import {type Command} from 'cli-engine-command'
import type Plugin from './plugins/plugin'
import path from 'path'
import {undefault} from './util'
const debug = require('debug')('cli:dispatcher')

class CommandManagerBase {
  config: Config
  constructor (config: Config) {
    this.config = config
  }
  async findCommand (id: string): Promise<?Class<Command<*>>> {
    return null
  }

  require (p: string): ?Class<Command<*>> {
    return undefault(require(p))
  }
}

class BuiltinCommandManager extends CommandManagerBase {
  async findCommand (id) {
    const builtins = {
      version: 'version',
      help: 'help'
    }

    let p = builtins[id]
    if (p) {
      p = path.join(__dirname, 'commands', p)
      return this.require(p)
    }
  }
}

class CLICommandManager extends CommandManagerBase {
  async findCommand (id) {
    let root = this.config.commandsDir
    if (!root) return
    let p
    try {
      debug(`finding ${id} command`)
      p = require.resolve(path.join(root, ...id.split(':')))
    } catch (err) {
      if (err.code !== 'MODULE_NOT_FOUND') throw err
    }
    if (p) return this.require(p)
  }
}

class PluginCommandManager extends CommandManagerBase {
  async findCommand (id) {
    const {default: Output} = require('cli-engine-command/lib/output')
    const {default: Plugins} = require('./plugins')
    let out = new Output(this.config)
    let plugins = new Plugins(out)
    await plugins.load()
    return plugins.findCommand(id || this.config.defaultCommand || 'help')
  }
}

export class Dispatcher {
  config: Config
  managers: CommandManagerBase[]

  constructor (config: Config) {
    this.config = config
    this.managers = [
      new PluginCommandManager(config),
      new CLICommandManager(config),
      new BuiltinCommandManager(config)
    ]
  }

  async findCommand (id: string): {
    Command?: ?Class<Command<*>>,
    plugin?: ?Plugin
  } {
    if (!id) return {}
    for (let manager of this.managers) {
      let Command = await manager.findCommand(id)
      if (Command) return {Command}
    }
    return {}
  }

  findTopic (id: string) {
    return null
    // let Topic = await plugins.findTopic(id)
  }
}
