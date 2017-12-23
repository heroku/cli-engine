import deps from '../deps'
import { IConfig } from 'cli-engine-config'
import { ICommand } from 'cli-engine-config'
import * as path from 'path'
import { PluginCache } from './cache'
import { PluginManifest } from './manifest'
import { Plugin, PluginType } from './plugin'
import { ITopics, Topic } from './topic'
import {Command} from 'cli-engine-command'
import {ICommandInfo, ILoadResult, ICommandManager} from '../command'

export class Builtin implements ICommandManager {
  private _commands: { [name: string]: string }
  private root: string

  constructor(protected config: IConfig) {
    // super({
    //   type: 'builtin',
    //   config,
    //   cache,
    //   manifest,
    //   root: path.join(__dirname, '..', 'commands'),
    //   pjson: require('../../package.json'),
    // })

  }

  public async load (): Promise<ILoadResult> {
    this.root = path.join(__dirname, '..', 'commands')
    let commandIDs = [
      'version'
    ]
    return {
      commands: await Promise.all(commandIDs.map(c => this.findCommand(c)))
    }
    // if (this.config.userPlugins) {
    //   result.commands = {
    //     ...result.commands,
    //     plugins: 'plugins',
    //     'plugins:install': 'plugins/install',
    //     'plugins:link': 'plugins/link',
    //     'plugins:uninstall': 'plugins/uninstall',
    //     'plugins:update': 'plugins/update',
    //     ...this._commands,
    //   }
    // }
  }

  // public async _topics(): Promise<ITopics> {
  //   const topics: ITopics = {}
  //   if (this.config.userPlugins) {
  //     topics.plugins = new Topic({
  //       name: 'plugins',
  //       description: 'manage plugins',
  //     })
  //   }
  //   return topics
  // }

  public async findCommand(id: string): Promise<ICommandInfo> {
    const m = await this.fetchModule(id)
    return {
      id,
      hidden: m.hidden,
      help: await m.buildHelp(this.config),
      helpLine: await m.buildHelpLine(this.config),
      run: async (argv) => {
        const m = await this.fetchModule(id)
        return m.run(argv.slice(3), this.config)
      }
    }
  }

  public fetchModule(id: string): Promise<ICommand> {
    let p = path.join(this.root, id.replace(/:/g, path.sep))
    return deps.util.undefault(require(p))
  }
}
