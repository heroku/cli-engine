import {Config, Topic} from 'cli-engine-config'
import plugins = require('../plugins')
import {CLI} from 'cli-ux'

import {CommandManagerBase} from './base'
import {deps} from '../deps'

export class PluginCommandManager extends CommandManagerBase {
  plugins: plugins.Plugins

  constructor ({config, cli}: {config: Config, cli: CLI}) {
    super({config, cli})
    this.plugins = new deps.Plugins(this.config, cli)
  }

  async listCommandIDs (): Promise<string[]> {
    let ids = await this.plugins.listCommandIDs()
    console.dir(ids)
    return []
    // await this.plugins.load()
    // return this.plugins.commands.map(c => c.id)
  }

  async findCommand (id: string) {
    if (id) return undefined
    return undefined
    // await this.plugins.load()
    // return this.plugins.findCommand(id)
  }

  async listTopics (): Promise<Topic[]> {
    return []
    // await this.plugins.load()
    // return this.plugins.topics
  }
}
