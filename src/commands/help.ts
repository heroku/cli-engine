import { flags } from '@cli-engine/command'
import { color } from '@heroku-cli/color'
import cli from 'cli-ux'
import { renderList } from 'cli-ux/lib/list'
import _ from 'ts-lodash'

import { CommandManager } from '../command'
import deps from '../deps'
import { ICommandInfo, Topic } from '../plugins/topic'

import Command from './base'

function topicSort(a: any, b: any) {
  if (a[0] < b[0]) return -1
  if (a[0] > b[0]) return 1
  return 0
}

export default class Help extends Command {
  static description = 'display help'
  static variableArgs = true
  static aliases = ['-h']
  static args = [{ name: 'subject', required: false }]
  static flags: flags.Input = {
    help: flags.boolean({ hidden: true }),
    all: flags.boolean({ description: 'show all commands' }),
  }

  cm: CommandManager

  async run() {
    this.cm = new CommandManager(this.config)
    let subject = this.args.subject
    if (!subject) {
      await this.topics()
      if (this.flags.all) {
        let rootCmds = await this.cm.rootCommands()
        if (rootCmds) {
          let rootTopics = await this.cm.rootTopics()
          rootCmds = rootCmds.filter(r => !Object.keys(rootTopics).includes(r.id))
          await this.listCommandsHelp(rootCmds)
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
      await this.listCommandsHelp(deps.util.objValues(topic.commands), topic)
    }
  }

  private async notFound(subject: string) {
    await deps.NotFound.run([subject], this.config)
  }

  private async topics(parent?: Topic) {
    let topics = deps.util
      .objValues(parent ? parent.subtopics : await this.cm.rootTopics())
      .filter(t => this.flags.all || !t.hidden)
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
    commands = commands.filter(c => this.flags.all || !c.hidden)
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
