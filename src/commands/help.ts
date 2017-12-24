import { Command, flags } from 'cli-engine-command'
import cli from 'cli-ux'
import { renderList } from 'cli-ux/lib/list'
import { color } from 'heroku-cli-color'
import _ from 'ts-lodash'
import { CommandManager } from '../command'
import deps from '../deps'
import { ICommandInfo, Topic } from '../plugins/topic'

function topicSort(a: any, b: any) {
  if (a[0] < b[0]) return -1
  if (a[0] > b[0]) return 1
  return 0
}

export default class Help extends Command {
  static description = 'display help'
  static variableArgs = true
  static flags: flags.Input = {
    all: flags.boolean({ description: 'show all commands' }),
  }

  cm: CommandManager

  async run() {
    this.cm = new CommandManager(this.config)
    let subject = this.argv.find(arg => !['-h', '--help'].includes(arg))
    if (!subject && !['-h', '--help', 'help'].includes(this.config.argv[1])) subject = this.config.argv[1]
    if (!subject) {
      await this.topics()
      if (this.flags.all) {
        let rootCmds = await this.cm.rootCommands()
        if (rootCmds) {
          await this.listCommandsHelp(Object.values(rootCmds))
        }
      }
      return
    }

    const topic = await this.cm.findTopic(subject)
    const command = await this.cm.findCommand(subject)

    if (!topic && !command) {
      return this.notFound(subject)
    }

    if (command) cli.log(command.help)

    if (topic) {
      await this.topics(topic)
      await this.listCommandsHelp(Object.values(topic.commands), topic)
    }
  }

  private async notFound(subject: string) {
    await deps.NotFound.run([subject], this.config)
  }

  private async topics(parent?: Topic) {
    let topics = Object.values(parent ? parent.subtopics : await this.cm.rootTopics())
      .filter(t => !t.hidden)
      .map(t => [` ${t.name}`, t.description ? color.dim(t.description) : null] as [string, string])
    topics.sort(topicSort)
    if (!topics.length) return topics

    // header
    cli.log(`${color.bold('Usage:')} ${this.config.bin} ${parent ? `${parent.name}:` : ''}COMMAND

Help topics, type ${color.cmd(this.config.bin + ' help TOPIC')} for more details:\n`)

    // display topics
    cli.log(renderList(topics))

    cli.log()
  }

  private async listCommandsHelp(commands: ICommandInfo[], topic?: Topic) {
    commands = _.sortBy(commands, 'id')
    commands = commands.filter(c => !c.hidden)
    if (commands.length === 0) return
    let helpCmd = color.cmd(`${this.config.bin} help ${topic ? `${topic.name}:` : ''}COMMAND`)
    if (topic) {
      cli.log(`${this.config.bin} ${color.bold(topic.name)} commands: (get help with ${helpCmd})\n`)
    } else {
      cli.log('Root commands:\n')
    }
    let helpLines = commands.map(c => c.helpLine).map(([a, b]) => [` ${a}`, b] as [string, string])
    cli.log(renderList(helpLines))
    cli.log()
  }
}
