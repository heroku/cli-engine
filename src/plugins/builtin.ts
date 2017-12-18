import { Config } from 'cli-engine-config'
import { PluginManager, Topics } from './manager'
import * as path from 'path'
import { ICommand } from 'cli-engine-config'

// const debug = require('debug')('cli:plugins:builtin')

export class Builtin extends PluginManager {
  private commands: { [name: string]: string }

  constructor({ config }: { config: Config }) {
    super({ config })

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
    }
  }

  public async commandIDs() {
    return Object.keys(this.commands)
  }

  public async aliases() {
    return {
      version: ['-v', '--version'],
    }
  }

  public async topics(): Promise<Topics> {
    const topics: Topics = {}
    if (true || this.config.userPlugins) {
      topics['plugins'] = {
        name: 'plugins',
        description: 'manage plugins',
        commands: [],
      }
    }
    return topics
  }

  public async findCommand(id: string): Promise<ICommand | undefined> {
    let p = this.commands[id]
    if (p) {
      p = path.join(__dirname, '..', 'commands', p)
      return this.require(p, id)
    }
  }

  protected require(p: string, id: string): ICommand {
    let m = super.require(p, id)
    m.plugin = { name: 'builtin', type: 'builtin', version: require('../../package.json').version, path: p }
    return m
  }
}
