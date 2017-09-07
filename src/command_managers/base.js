// @flow

import type {Config, Topic, ICommand} from 'cli-engine-config'
import type Output from 'cli-engine-command/lib/output'
import {undefault} from '../util'
import deps from '../deps'
import {inspect} from 'util'

export class CommandManagerBase {
  config: Config
  out: Output

  constructor ({config, out}: {config: Config, out?: ?Output}) {
    this.config = config
    this.out = out || new deps.Output(this.config)
  }

  async findCommand (id: string): Promise<?ICommand> {
    throw new Error('not implemented')
  }

  async listTopics (): Promise<Topic[]> {
    throw new Error('not implemented')
  }

  require (p: string, id: string): ?ICommand {
    const command = undefault(require(p))
    if (!command || !command.run) {
      let extra = deps.util.isEmpty(command) ? 'Does the command have `module.exports = MyCommand`?' : `Received: ${inspect(command)}`
      throw new Error(`${p} does not appear to be a valid command.\n${extra}`)
    }
    command.topic = id.split(':').slice(0, -1).join(':')
    command.command = id.split(':').pop()
    if (!command.id) command.id = id
    return command
  }

  async listCommandIDs (): Promise<string[]> {
    throw new Error('not implemented')
  }

  async findTopic (id: string): Promise<?Topic> {
    let topics = await this.listTopics()
    return topics.find(t => t.name === id)
  }

  async listTopicIDs (): Promise<string[]> {
    const commands = await this.listCommandIDs()
    const topics = deps.uniq(commands
      // first get just the topic each command is in
      .map(c => c.split(':').slice(0, -1)))
      // take out commands at the root topic
      .filter(c => c.length !== 0)
      // add in subtopics
      .reduce((arr, t) => {
        let subtopics = []
        for (let elem of t) {
          arr.push(subtopics.concat(elem).join(':'))
          subtopics.push(elem)
        }
        return deps.uniq(arr)
      }, [])
    return topics
  }

  async commandsForTopic (topic: string): Promise<ICommand[]> {
    const ids = await this.commandIDsForTopic(topic)
    return Promise.all(ids.map(id => this.findCommand(id)))
  }

  async listRootCommands (): Promise<ICommand[]> {
    const ids = await this.listRootCommandIDs()
    return Promise.all(ids.map(id => this.findCommand(id)))
  }

  async commandIDsForTopic (topic: string): Promise<string[]> {
    let ids = await this.listCommandIDs()
    // show matching commands
    ids = ids.filter(id => id === topic || id.startsWith(`${topic}:`))
    // only show one level deeper than the topic
    ids = ids.filter(id => id.split(':').length <= topic.split(':').length + 1)
    return ids
  }

  async listRootCommandIDs (): Promise<string[]> {
    let ids = await this.listCommandIDs()
    return ids.filter(id => !id.includes(':'))
  }
}
