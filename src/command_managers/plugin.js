// @flow

import type {Config, Topic} from 'cli-engine-config'
import type Output from 'cli-engine-command/lib/output'
import type Plugins from '../plugins'

import {CommandManagerBase} from './base'
import deps from '../deps'

export class PluginCommandManager extends CommandManagerBase {
  plugins: Plugins

  constructor ({config, out}: {config: Config, out?: Output}) {
    super({config, out})
    this.plugins = new deps.Plugins(this.out)
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
      .map(t => ({
        name: t.id,
        description: t.description,
        hidden: t.hidden
      }))
  }
}
