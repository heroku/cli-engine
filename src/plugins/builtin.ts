import { PluginManager } from './manager'
import * as path from 'path'
import { ICommand } from 'cli-engine-config'

export class Builtin extends PluginManager {
  private commands: { [name: string]: string }

  protected async _init() {
    this.commands = {
      commands: 'commands',
      help: 'help',
      update: 'update',
      version: 'version',
      which: 'which',
    }
    if (true || this.config.userPlugins) {
      this.commands = {
        ...this.commands,
        plugins: 'plugins',
        'plugins:install': 'plugins/install',
        'plugins:link': 'plugins/link',
        'plugins:uninstall': 'plugins/uninstall',
        'plugins:update': 'plugins/update',
        ...this.commands,
      }
      this.topics['plugins'] = {
        name: 'plugins',
        description: 'manage plugins',
        commands: []
      }
    }

    this.commandIDs = Object.keys(this.commands)
  }

  protected _findCommand(id: string): ICommand | undefined {
    let p = this.commands[id]
    if (p) {
      p = path.join(__dirname, '..', 'commands', p)
      return this.require(p, id)
    }
  }

  protected require(p: string, id: string): ICommand {
    let m = super.require(p, id)
    m.plugin = { name: 'builtin', version: require('../../package.json').version }
    return m
  }
}
