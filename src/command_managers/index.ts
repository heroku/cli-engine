import { Config } from 'cli-engine-config'
import { CommandManagerBase } from './base'

export class CommandManager extends CommandManagerBase {
  constructor(config: Config) {
    super(config)
    // const {ConventionalCommandManager} = require('./conventional')
    const { BuiltinCommandManager } = require('./builtin')
    if (true || this.config.userPlugins) {
      const { Plugins } = require('../plugins')
      this.submanagers.push(new Plugins(config))
    }
    // if (config.commandsDir) this.managers.push(new ConventionalCommandManager({config, cli, commandsDir: config.commandsDir}))
    this.submanagers.push(new BuiltinCommandManager(config))
  }
}
