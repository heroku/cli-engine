import { Config, Topic, ICommand } from 'cli-engine-config'
import { CLI } from 'cli-ux'
import { inspect } from 'util'
import { deps } from '../deps'
import _ from '../lodash'

export abstract class CommandManagerBase {
  config: Config
  cli: CLI

  constructor({ config, cli }: { config: Config; cli: CLI }) {
    this.config = config
    this.cli = cli
  }

  abstract findCommand(id: string): Promise<ICommand | undefined>
  abstract listTopics(): Promise<Topic[]>

  require(p: string, id: string): ICommand | undefined {
    const command = deps.util.undefault(require(p))
    if (!command || !command.run) {
      let extra = deps.util.isEmpty(command)
        ? 'Does the command have `module.exports = MyCommand`?'
        : `Received: ${inspect(command)}`
      throw new Error(`${p} does not appear to be a valid command.\n${extra}`)
    }
    command.topic = id
      .split(':')
      .slice(0, -1)
      .join(':')
    command.command = id.split(':').pop()
    if (!command.id) command.id = id
    return command
  }

  abstract listCommandIDs(): Promise<string[]>

  async findTopic(id: string): Promise<Topic | undefined> {
    let topics = await this.listTopics()
    return topics.find(t => t.name === id)
  }

  async listTopicIDs(): Promise<string[]> {
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

  async commandsForTopic(topic: string): Promise<ICommand[]> {
    let ids = await this.commandIDsForTopic(topic)
    let commands = await Promise.all(ids.map(id => this.findCommand(id)))
    return _.compact(commands)
  }

  async listRootCommands(): Promise<ICommand[]> {
    const ids = await this.listRootCommandIDs()
    let commands = await Promise.all(ids.map(id => this.findCommand(id)))
    return _.compact(commands)
  }

  async commandIDsForTopic(topic: string): Promise<string[]> {
    let ids = await this.listCommandIDs()
    // show matching commands
    ids = ids.filter(id => id === topic || id.startsWith(`${topic}:`))
    // only show one level deeper than the topic
    ids = ids.filter(id => id.split(':').length <= topic.split(':').length + 1)
    return ids
  }

  async listRootCommandIDs(): Promise<string[]> {
    let ids = await this.listCommandIDs()
    return ids.filter(id => !id.includes(':'))
  }
}
