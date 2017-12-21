import { IConfig } from 'cli-engine-config'
import { ICommand } from 'cli-engine-config'
import * as path from 'path'
import { ITopics, Topic } from '../topic'
import { PluginCache } from './cache'
import { PluginManifest } from './manifest'
import { Plugin, PluginType } from './plugin'

export class Builtin extends Plugin {
  public type: PluginType = 'builtin'
  private _commands: { [name: string]: string }

  constructor({ config, manifest, cache }: { config: IConfig; manifest: PluginManifest; cache: PluginCache }) {
    super({
      cache,
      config,
      manifest,
      pjson: require('../../package.json'),
      root: path.join(__dirname, '..', 'commands'),
      type: 'builtin',
    })

    this._commands = {
      commands: 'commands',
      help: 'help',
      update: 'update',
      version: 'version',
      which: 'which',
    }
    if (this.config.userPlugins) {
      this._commands = {
        ...this._commands,
        plugins: 'plugins',
        'plugins:install': 'plugins/install',
        'plugins:link': 'plugins/link',
        'plugins:uninstall': 'plugins/uninstall',
        'plugins:update': 'plugins/update',
        ...this._commands,
      }
    }
  }

  public async _findCommand(id: string): Promise<ICommand | undefined> {
    let p = this._commands[id]
    if (p) {
      p = path.join(this.root, p)
      return this.require(p, id)
    }
  }

  protected async _topics(): Promise<ITopics> {
    const topics: ITopics = {}
    if (this.config.userPlugins) {
      topics.plugins = new Topic({
        description: 'manage plugins',
        name: 'plugins',
      })
    }
    return topics
  }

  protected require(p: string, id: string): ICommand {
    let m = super.require(p, id)
    return this.addPluginToCommand(m)
  }

  protected async _commandIDs() {
    return Object.keys(this._commands)
  }
}
