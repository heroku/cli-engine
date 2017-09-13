import {Command} from 'cli-engine-command'
import {Config, ICommand} from 'cli-engine-config'
import {renderList} from 'cli-ux/lib/list'
import {CommandManager} from '../command_managers'
import {deps} from '../deps'

function topicSort (a: any, b: any) {
  if (a[0] < b[0]) return -1
  if (a[0] > b[0]) return 1
  return 0
}

function buildHelp (config: Config, c: ICommand): string {
  if (c.buildHelp) return c.buildHelp(config)
  let help = new deps.CLICommandHelp(config)
  return help.command(c)
}

function buildHelpLine (config: Config, c: ICommand): [string, string | undefined] {
  if (c.buildHelpLine) return c.buildHelpLine(config)
  let help = new deps.CLICommandHelp(config)
  return help.commandLine(c)
}

export default class Help extends Command {
  options = {
    description: 'display help',
    strict: false,
  }

  commandManager: CommandManager

  async run () {
    this.commandManager = new CommandManager(this.config)
    let subject = this.config.argv.slice(2).find(arg => !['help', '-h', '--help'].includes(arg))
    if (!subject) {
      let topics = await this.topics()
      let cmds = await this.commandManager.listRootCommands()
      cmds = cmds.filter(c => !topics.find(t => c.__config.id!.startsWith(t[0])))
      if (cmds) this.listCommandsHelp(cmds)
      return
    }

    const topic = await this.commandManager.findTopic(subject)
    const matchedCommand = await this.commandManager.findCommand(subject)

    if (!topic && !matchedCommand) {
      return this.notFound(subject)
    }

    if (matchedCommand) {
      this.cli.log(buildHelp(this.config, matchedCommand))
    }

    if (topic) {
      await this.topics(topic.name)
      const cmds = await this.commandManager.commandsForTopic(topic.name)
      if (cmds) this.listCommandsHelp(cmds, subject)
    }
  }

  private async notFound (subject: string) {
    await deps.NotFound.run({...this.config, argv: this.config.argv.slice(2).concat([subject])})
  }

  private async topics (prefix?: string) {
    const idPrefix = prefix ? `${prefix}:` : ''
    // fetch topics
    let topics = (await this.commandManager.listTopics())
      .filter(t => !t.hidden)
      // only get from the prefix
      .filter(t => t.name.startsWith(idPrefix))
      // only get topics 1 level deep
      .filter(t => t.name.split(':').length <= (prefix || '').split(':').length + 1)
      .map(t => [
        t.name,
        t.description ? this.color.dim(t.description) : null
      ] as [string, string])
    topics.sort(topicSort)
    if (!topics.length) return topics

    // header
    this.cli.log(`${this.color.bold('Usage:')} ${this.config.bin} ${idPrefix}COMMAND

Help topics, type ${this.color.cmd(this.config.bin + ' help TOPIC')} for more details:`)

    // display topics
    this.cli.log(renderList(topics))

    this.cli.log()
    return topics
  }

  private listCommandsHelp (commands: ICommand[], topic?: string) {
    commands = commands.filter(c => !c.options.hidden)
    if (commands.length === 0) return
    commands.sort(deps.util.compare('id'))
    let helpCmd = this.color.cmd(`${this.config.bin} help ${topic ? `${topic}:` : ''}COMMAND`)
    if (topic) {
      this.cli.log(`${this.config.bin} ${this.color.bold(topic)} commands: (get help with ${helpCmd})`)
    } else {
      this.cli.log('Root commands:')
    }
    let helpLines = commands.map(c => buildHelpLine(this.config, c))
    this.cli.log(renderList(helpLines))
    this.cli.log()
  }

}
