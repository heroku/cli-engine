import {CommandManagerBase} from './base'
import * as path from 'path'
import {Topic} from 'cli-engine-config'

export class BuiltinCommandManager extends CommandManagerBase {
  commands: {[name: string]: string}
  topics: Topic[]

  constructor ({config, cli}: CommandManagerBase) {
    super({config, cli})
    this.commands = {
      commands: 'commands',
      help: 'help',
      update: 'update',
      version: 'version',
      which: 'which'
    }
    this.topics = []
    if (this.config.userPlugins) {
      this.commands = {
        'plugins': 'plugins',
        'plugins:install': 'plugins/install',
        'plugins:link': 'plugins/link',
        'plugins:uninstall': 'plugins/uninstall',
        'plugins:update': 'plugins/update',
        ...this.commands
      }
      this.topics.push({name: 'plugins', description: 'manage plugins'})
    }
  }

  async findCommand (id: string) {
    let p = this.commands[id]
    if (p) {
      p = path.join(__dirname, '..', 'commands', p)
      return this.require(p, id)
    }
  }

  async listTopics () {
    return this.topics
  }

  async listTopicIDs () {
    return this.topics.map(t => t.name)
  }

  async listCommandIDs () {
    return Object.keys(this.commands)
  }
}
