import { IConfig } from 'cli-engine-config'
import * as path from 'path'
import { Plugin, PluginType } from './plugin'

export class Builtin extends Plugin {
  public type: PluginType = 'builtin'

  constructor(protected config: IConfig) {
    super({
      config,
      root: path.join(__dirname, '..', '..'),
      pjson: require('../../package.json'),
    })
  }

  protected get commandsDir(): string | undefined {
    return path.join(__dirname, '..', 'commands')
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
}
