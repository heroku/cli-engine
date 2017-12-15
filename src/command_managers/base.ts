import { Command as CommandBase } from 'cli-engine-command'
import { Config, Topic, ICommand } from 'cli-engine-config'
import cli from 'cli-ux'
import { inspect } from 'util'
import _ from 'ts-lodash'
import * as util from '../util'

const debug = require('debug')('cli:commands')

function uniqTopics(topics: Topic[]): Topic[] {
  topics = _.sortBy(topics, t => [t.name, t.hidden, t.description])
  topics = _.sortedUniqBy(topics, t => t.name)
  return topics
}

function uniqCommandIDs(ids: string[]): string[] {
  ids = ids.sort()
  ids = _.sortedUniqBy(ids, t => t)
  return ids
}

export abstract class CommandManagerBase {
  protected initialized = false
  protected submanagers: CommandManagerBase[] = []

  constructor(protected config: Config) {}

  public async findCommand(id: string): Promise<ICommand | undefined> {
    id = this.unalias(id)
    let finders = this.submanagers.map(m => m.findCommand(id))
    for (let p of finders) {
      let Command = await p
      if (Command) return Command
    }
  }

  public async listTopics(): Promise<Topic[]> {
    let arrs = await Promise.all(this.submanagers.map(m => m.listTopics()))
    let topics = arrs.reduce((next, res) => next.concat(res), [])
    return uniqTopics(topics)
  }

  public async listCommandIDs(): Promise<string[]> {
    let arrs = await Promise.all(this.submanagers.map(m => m.listCommandIDs()))
    let ids = arrs.reduce((next, res) => next.concat(res), [])
    return uniqCommandIDs(ids)
  }

  public async findTopic(id: string): Promise<Topic | undefined> {
    let topics = await this.listTopics()
    return topics.find(t => t.name === id)
  }

  public async listRootCommands(): Promise<ICommand[]> {
    const ids = await this.listRootCommandIDs()
    console.dir(ids)
    let commands = _.compact(await Promise.all(ids.map(id => this.findCommand(id))))
    commands = _.sortBy(commands, c => c.id)
    commands = _.sortedUniqBy(commands, c => c.id)
    return commands
  }

  public async commandsForTopic(topic: string): Promise<ICommand[]> {
    let ids = await this.commandIDsForTopic(topic)
    let commands = _.compact(await Promise.all(ids.map(id => this.findCommand(id))))
    commands = _.sortBy(commands, c => c.id)
    commands = _.sortedUniqBy(commands, c => c.id)
    return commands
  }

  public async init(): Promise<void> {
    if (this.initialized) return
    await this._init()
    await Promise.all(this.submanagers.map(m => m.init()))
    this.initialized = true
  }
  protected abstract async _init(): Promise<void>

  protected async listTopicIDs(): Promise<string[]> {
    const commands = await this.listCommandIDs()
    const topics = _.uniq(
      commands
        // first get just the topic each command is in
        .map(c => c.split(':').slice(0, -1)),
    )
      // take out commands at the root topic
      .filter(c => c.length !== 0)
      // add in subtopics
      .reduce((arr, t) => {
        let subtopics = []
        for (let elem of t) {
          arr.push(subtopics.concat(elem).join(':'))
          subtopics.push(elem)
        }
        return _.uniq(arr)
      }, [])
    return topics
  }

  protected async commandIDsForTopic(topic: string): Promise<string[]> {
    let ids = await this.listCommandIDs()
    // show matching commands
    ids = ids.filter(id => id === topic || id.startsWith(`${topic}:`))
    // only show one level deeper than the topic
    ids = ids.filter(id => id.split(':').length <= topic.split(':').length + 1)
    return ids
  }

  protected async listRootCommandIDs(): Promise<string[]> {
    let ids = await this.listCommandIDs()
    return ids.filter(id => !id.includes(':'))
  }

  protected require(p: string, id: string): ICommand {
    debug('Reading command %s at %s', id, p)
    let Command: undefined | typeof CommandBase
    try {
      Command = util.undefault(require(p))
    } catch (err) {
      cli.warn(err, { context: `Error reading command from ${p}` })
    }
    if (!Command || !(Command.prototype instanceof CommandBase)) {
      let extra = util.isEmpty(Command)
        ? 'Does the command have `module.exports = MyCommand`?'
        : `Received: ${inspect(Command)}`
      throw new Error(`${p} does not appear to be a valid command.\n${extra}`)
    }
    return Command
  }

  private unalias(id: string): string {
    const alias = Object.entries(this.config.aliases).find(([, aliases]) => aliases.includes(id))
    return alias ? alias[0] : id
  }
}
