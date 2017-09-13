import {Config, Topic} from 'cli-engine-config'
import Plugins from '../plugins'
import {CLI} from 'cli-ux'

import {CommandManagerBase} from './base'
import {deps} from '../deps'

export class PluginCommandManager extends CommandManagerBase {
  plugins: Plugins

  constructor ({config, cli}: {config: Config, cli: CLI}) {
    super({config, cli})
    this.plugins = new deps.Plugins(this.config, cli)
  }

  async listCommandIDs (): Promise<string[]> {
    await this.plugins.load()
    return this.plugins.commands.map(c => c.id)
  }

  async findCommand (id: string) {
    await this.plugins.load()
    return this.plugins.findCommand(id)
  }

  async listTopics (): Promise<Topic[]> {
    await this.plugins.load()
    return this.plugins.topics
  }
}
