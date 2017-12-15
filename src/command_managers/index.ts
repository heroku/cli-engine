import { CommandManagerBase } from './base'

export class CommandManager extends CommandManagerBase {
  public async _init() {
    const { BuiltinCommandManager } = require('./builtin')
    if (true || this.config.userPlugins) {
      const { Plugins } = require('../plugins')
      this.submanagers.push(new Plugins(this.config))
    }
    this.submanagers.push(new BuiltinCommandManager(this.config))
  }
}
