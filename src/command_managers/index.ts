import {Config, ICommand, Topic} from 'cli-engine-config'
import {CommandManagerBase} from './base'
import {CLI} from 'cli-ux'
import _ from '../lodash'

const debug = require('debug')('cli:commands')

function uniqTopics (topics: Topic[]): Topic[] {
  topics = _.sortBy(topics, t => [t.name, t.hidden, t.description])
  topics = _.sortedUniqBy(topics, t => t.name)
  return topics
}

function uniqCommandIDs (ids: string[]): string[] {
  ids = ids.sort()
  ids = _.sortedUniqBy(ids, t => t)
  return ids
}

export class CommandManager {
  readonly cli: CLI
  managers: CommandManagerBase[]

  constructor (readonly config: Config, cli?: CLI) {
    // const {ConventionalCommandManager} = require('./conventional')
    const {BuiltinCommandManager} = require('./builtin')
    this.cli = cli || new CLI({debug: !!config.debug, mock: config.mock, errlog: config.errlog})
    this.managers = []
    // if (this.config.userPlugins) {
    //   const {PluginCommandManager} = require('./plugin')
    //   this.managers.push(new PluginCommandManager({config, cli}))
    // }
    // if (config.commandsDir) this.managers.push(new ConventionalCommandManager({config, cli, commandsDir: config.commandsDir}))
    this.managers.push(new BuiltinCommandManager({config, cli}))
  }

  async findCommand (id: string): Promise<ICommand | undefined> {
    debug(id)
    for (let manager of this.managers) {
      let Command = await manager.findCommand(id)
      if (Command) {
        debug(`found in ${manager.constructor.name}`)
        return Command
      }
    }
  }

  async findTopic (id: string): Promise<Topic | undefined> {
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
    commands = _.sortBy(commands, c => c.id)
    commands = _.sortedUniqBy(commands, c => c.id)
    return commands
  }

  async listRootCommands (): Promise<ICommand[]> {
    let arrs = await Promise.all(this.managers.map(m => m.listRootCommands()))
    let commands = arrs.reduce((next, res) => next.concat(res), [])
    commands = _.sortBy(commands, c => c.id)
    commands = _.sortedUniqBy(commands, c => c.id)
    return commands
  }

  async listCommandIDs (): Promise<string[]> {
    let arrs = await Promise.all(this.managers.map(m => m.listCommandIDs()))
    let ids = arrs.reduce((next, res) => next.concat(res), [])
    return uniqCommandIDs(ids)
  }
}
