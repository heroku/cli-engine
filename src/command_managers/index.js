// @flow

import type {Config, ICommand, Topic} from 'cli-engine-config'
import type Output from 'cli-engine-command/lib/output'
import type {CommandManagerBase} from './base'
import deps from '../deps'

const debug = require('debug')('cli:commands')

type ConstructorOpts = {|
  config: Config,
  out?: Output
|}

function uniqTopics (topics: Topic[]): Topic[] {
  topics = deps.sortBy(topics, t => [t.name, t.hidden, t.description])
  topics = deps.sortedUniqBy(topics, t => t.name)
  return topics
}

function uniqCommandIDs (ids: string[]): string[] {
  ids = ids.sort()
  ids = deps.sortedUniqBy(ids, t => t)
  return ids
}

export class CommandManager {
  config: Config
  managers: CommandManagerBase[]
  out: Output

  constructor ({config, out}: ConstructorOpts) {
    const {ConventionalCommandManager} = require('./conventional')
    const {BuiltinCommandManager} = require('./builtin')
    this.config = config
    this.out = out || new deps.Output(config)
    this.managers = []
    if (this.config.userPlugins) {
      const {PluginCommandManager} = require('./plugin')
      this.managers.push(new PluginCommandManager({config, out}))
    }
    if (config.commandsDir) this.managers.push(new ConventionalCommandManager({config, out, commandsDir: config.commandsDir}))
    this.managers.push(new BuiltinCommandManager({config, out}))
  }

  async findCommand (id: string): Promise<?ICommand> {
    debug(id)
    for (let manager of this.managers) {
      let Command = await manager.findCommand(id)
      if (Command) {
        debug(`found in ${manager.constructor.name}`)
        return Command
      }
    }
  }

  async findTopic (id: string): Promise<?Topic> {
    for (let manager of this.managers) {
      let topic = await manager.findTopic(id)
      if (topic) return topic
    }
  }

  async listTopics () {
    let arrs = await Promise.all(this.managers.map(m => m.listTopics()))
    let topics = arrs.reduce((next, res) => next.concat(res), [])
    return uniqTopics(topics)
  }

  async commandsForTopic (topic: string): Promise<ICommand[]> {
    let arrs = await Promise.all(this.managers.map(m => m.commandsForTopic(topic)))
    let commands = arrs.reduce((next, res) => next.concat(res), [])
    commands = deps.sortBy(commands, c => c.id)
    commands = deps.sortedUniqBy(commands, c => c.id)
    return commands
  }

  async listRootCommands (): Promise<ICommand[]> {
    let arrs = await Promise.all(this.managers.map(m => m.listRootCommands()))
    let commands = arrs.reduce((next, res) => next.concat(res), [])
    commands = deps.sortBy(commands, c => c.id)
    commands = deps.sortedUniqBy(commands, c => c.id)
    return commands
  }

  async listCommandIDs (): Promise<string[]> {
    let arrs = await Promise.all(this.managers.map(m => m.listCommandIDs()))
    let ids = arrs.reduce((next, res) => next.concat(res), [])
    return uniqCommandIDs(ids)
  }
}
