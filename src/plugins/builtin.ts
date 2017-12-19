import { PluginCache } from './cache'
import { Plugin, PluginType } from './plugin'
import { Config } from 'cli-engine-config'
import { Topics, Topic } from './topic'
import * as path from 'path'
import { ICommand } from 'cli-engine-config'
import { PluginManifest } from './manifest'

export class Builtin extends Plugin {
  public type: PluginType = 'builtin'
  private _commands: { [name: string]: string }

  constructor({ config, manifest, cache }: { config: Config; manifest: PluginManifest; cache: PluginCache }) {
    super({
      type: 'builtin',
      name: 'builtin',
      config,
      cache,
      manifest,
      root: path.join(__dirname, '..', 'commands'),
      version: require('../../package.json').version,
    })

    this._commands = {
      commands: 'commands',
      help: 'help',
      update: 'update',
      version: 'version',
      which: 'which',
    }
    if (true || this.config.userPlugins) {
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

  public async _aliases() {
    return {
      'plugins:uninstall': ['plugins:unlink'],
      version: ['-v', '--version'],
    }
  }

  public async _findCommand(id: string): Promise<ICommand | undefined> {
    let p = this._commands[id]
    if (p) {
      p = path.join(this.root, p)
      return this.require(p, id)
    }
  }

  protected require(p: string, id: string): ICommand {
    let m = super.require(p, id)
    return this.addPluginToCommand(m)
  }

  public async _topics(): Promise<Topics> {
    const topics: Topics = {}
    if (true || this.config.userPlugins) {
      topics['plugins'] = new Topic({
        name: 'plugins',
        description: 'manage plugins',
      })
    }
    return topics
  }

  protected async _commandIDs() {
    return Object.keys(this._commands)
  }
}
