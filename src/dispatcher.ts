import { Config } from 'cli-engine-config'
import { Command } from 'cli-engine-command'
import * as path from 'path'
import { undefault } from './util'
const debug = require('debug')('cli:dispatcher')

class CommandManagerBase {
  config: Config
  constructor(config: Config) {
    this.config = config
  }
  async findCommand(_: string): Promise<typeof Command | undefined> {
    return undefined
  }

  async listTopics() {
    return []
  }

  require(p: string): typeof Command {
    return undefault(require(p))
  }
}

class BuiltinCommandManager extends CommandManagerBase {
  async findCommand(id: string) {
    const builtins: { [name: string]: string } = {
      version: 'version',
      help: 'newhelp',
    }

    let p = builtins[id]
    if (p) {
      p = path.join(__dirname, 'commands', p)
      return this.require(p)
    }
  }
}

class CLICommandManager extends CommandManagerBase {
  async findCommand(id: string) {
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
  async findCommand(id: string) {
    const { default: Plugins } = require('./plugins')
    let plugins = new Plugins(this.config)
    await plugins.load()
    let Command = await plugins.findCommand(id || this.config.defaultCommand || 'help')
    if (!Command) return
    Command.plugin = await plugins.findPluginWithCommand(Command.id)
    return Command
  }
}

export class Dispatcher {
  config: Config
  private managers: CommandManagerBase[]

  constructor(config: Config) {
    this.config = config
    this.managers = [new CLICommandManager(config), new BuiltinCommandManager(config)]
    if (this.config.userPlugins) {
      this.managers.unshift(new PluginCommandManager(config))
    }
  }

  async findCommand(id: string) {
    if (!id) return
    for (let manager of this.managers) {
      let Command = await manager.findCommand(id)
      if (Command) return Command
    }
  }

  findTopic(_: string) {
    return null
    // let Topic = await plugins.findTopic(id)
  }

  async listTopics() {
    let arrs = await Promise.all(this.managers.map(m => m.listTopics()))
    return arrs.reduce((next, res) => res.concat(next), [])
  }

  get cmdAskingForHelp(): boolean {
    for (let arg of this.config.argv) {
      if (['--help', '-h'].includes(arg)) return true
      if (arg === '--') return false
    }
    return false
  }
}
