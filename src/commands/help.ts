import { color } from 'heroku-cli-color'
import cli from 'cli-ux'
import { IBooleanFlag } from 'cli-flags'
import { Command, flags } from 'cli-engine-command'
import { renderList } from 'cli-ux/lib/list'
import { Plugins } from '../plugins'
import deps from '../deps'

function topicSort(a: any, b: any) {
  if (a[0] < b[0]) return -1
  if (a[0] > b[0]) return 1
  return 0
}

export default class Help extends Command {
  static description = 'display help'
  static variableArgs = true
  static flags = {
    all: flags.boolean({ description: 'show all commands' }) as IBooleanFlag,
  }

  plugins: Plugins

  async run() {
    this.plugins = new Plugins({ config: this.config })
    let subject = this.argv.find(arg => !['-h', '--help'].includes(arg))
    if (!subject && !['-h', '--help', 'help'].includes(this.config.argv[2])) subject = this.config.argv[2]
    if (!subject) {
      let topics = await this.topics()
      if (this.flags.all) {
        let rootCmds = await this.plugins.rootCommandIDs()
        rootCmds = rootCmds.filter(c => !topics.find(t => c.startsWith(t[0])))
        if (rootCmds) await this.listCommandsHelp(rootCmds)
      }
      return
    }

    const topic = await this.plugins.findTopic(subject)
    const commandHelp = await this.plugins.findCommandHelp(subject)

    if (!topic && !commandHelp) {
      return this.notFound(subject)
    }

    if (commandHelp) cli.log(commandHelp)

    if (topic) {
      await this.topics(topic.name)
      await this.listCommandsHelp(topic.commands, subject)
    }
  }

  private async notFound(subject: string) {
    await deps.NotFound.run({ ...this.config, argv: [subject] })
  }

  private async topics(prefix?: string) {
    const idPrefix = prefix ? `${prefix}:` : ''
    // fetch topics
    let topics = Object.values(await this.plugins.topics())
      .filter(t => !t.hidden)
      // only get from the prefix
      .filter(t => t.name.startsWith(idPrefix))
      // only get topics 1 level deep
      .filter(t => t.name.split(':').length < (prefix || '').split(':').length + 1)
      .map(t => [` ${t.name}`, t.description ? color.dim(t.description) : null] as [string, string])
    topics.sort(topicSort)
    if (!topics.length) return topics

    // header
    cli.log(`${color.bold('Usage:')} ${this.config.bin} ${idPrefix}COMMAND

Help topics, type ${color.cmd(this.config.bin + ' help TOPIC')} for more details:`)

    // display topics
    cli.log(renderList(topics))

    cli.log()
    return topics
  }

  private async listCommandsHelp(commandIDs: string[], topic?: string) {
    let helpLines = await this.plugins.findCommandsHelpLines(commandIDs)
    // commands = commands.filter(c => !c.hidden)
    if (helpLines.length === 0) return
    let helpCmd = color.cmd(`${this.config.bin} help ${topic ? `${topic}:` : ''}COMMAND`)
    if (topic) {
      cli.log(`${this.config.bin} ${color.bold(topic)} commands: (get help with ${helpCmd})`)
    } else {
      cli.log('Root commands:')
    }
    helpLines = helpLines.map(([a, b]) => [` ${a}`, b] as [string, string])
    cli.log(renderList(helpLines))
    cli.log()
  }
}
