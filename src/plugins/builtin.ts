import { PluginCache } from './cache'
import { Plugin, PluginType } from './plugin'
import { Config } from 'cli-engine-config'
import { Topics } from './manager'
import * as path from 'path'
import { ICommand } from 'cli-engine-config'

export class Builtin extends Plugin {
  public type: PluginType = 'builtin'
  public name = 'builtin'
  public version = require('../../package.json').version
  private commands: { [name: string]: string }

  constructor({ config, cache }: { config: Config; cache: PluginCache }) {
    super({ config, cache, root: path.join(__dirname, '..', 'commands') })

    this.commands = {
      commands: 'commands',
      'cache:warm': 'cache/warm',
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

  public async init() {}

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
      p = path.join(this.root, p)
      return this.require(p, id)
    }
  }

  protected require(p: string, id: string): ICommand {
    let m = super.require(p, id)
    return this.addPluginToCommand(m)
  }
}
