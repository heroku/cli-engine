// @flow

import Command from 'cli-engine-command'
import type {ICommand} from 'cli-engine-config'
import {stdtermwidth} from 'cli-engine-command/lib/output/screen'
import {CommandManager} from '../command_managers'
import deps from '../deps'
import {compare} from '../util'

function trimToMaxLeft (n: number): number {
  let max = parseInt(stdtermwidth * 0.6)
  return n > max ? max : n
}

function trimCmd (s: string, max: number): string {
  if (s.length <= max) return s
  return `${s.slice(0, max - 1)}\u2026`
}

function renderList (items: [string, ?string][]): string {
  const S = require('string')
  const max = require('lodash.maxby')

  let maxLeftLength = trimToMaxLeft(max(items, '[0].length')[0].length + 1)
  return items
    .map(i => {
      let left = ` ${i[0]}`
      let right = i[1]
      if (!right) return left
      left = `${S(trimCmd(left, maxLeftLength)).padRight(maxLeftLength)}`
      right = linewrap(maxLeftLength + 2, right)
      return `${left}  ${right}`
    }).join('\n')
}

function linewrap (length: number, s: string): string {
  const linewrap = require('@heroku/linewrap')
  return linewrap(length, stdtermwidth, {
    skipScheme: 'ansi-color'
  })(s).trim()
}

function topicSort (a, b) {
  if (a[0] < b[0]) return -1
  if (a[0] > b[0]) return 1
  return 0
}

export default class Help extends Command<*> {
  static topic = 'help'
  static description = 'display help'
  static variableArgs = true

  commandManager: CommandManager

  async run () {
    this.commandManager = new CommandManager({config: this.config, out: this.out})
    let subject = this.config.argv.slice(1).find(arg => !['help', '-h', '--help'].includes(arg))
    if (!subject) {
      let topics = await this.topics()
      let cmds = await this.commandManager.listRootCommands()
      cmds = cmds.filter(c => !topics.find(t => c.id.startsWith(t[0])))
      if (cmds) this.listCommandsHelp(cmds)
      return
    }

    const topic = await this.commandManager.findTopic(subject)
    const matchedCommand = await this.commandManager.findCommand(subject)

    if (!topic && !matchedCommand) {
      await deps.NotFound.run({...this.config, argv: [this.config.argv[0], subject]})
      return
    }

    if (matchedCommand) {
      this.out.log(this.buildHelp(matchedCommand))
    }

    if (topic) {
      await this.topics(topic.name)
      const cmds = await this.commandManager.commandsForTopic(topic.name)
      if (cmds) this.listCommandsHelp(cmds, subject)
    }
  }

  async topics (prefix?: string) {
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
        t.description ? this.out.color.dim(t.description) : null
      ])
    topics.sort(topicSort)
    if (!topics.length) return topics

    // header
    let color = this.out.color
    this.out.log(`${color.bold('Usage:')} ${this.config.bin} ${idPrefix}COMMAND

Help topics, type ${this.out.color.cmd(this.config.bin + ' help TOPIC')} for more details:`)

    // display topics
    this.out.log(renderList(topics))

    this.out.log()
    return topics
  }

  listCommandsHelp (commands: ICommand[], topic?: string) {
    commands = commands.filter(c => !c.hidden)
    if (commands.length === 0) return
    commands.sort(compare('id'))
    let helpCmd = this.out.color.cmd(`${this.config.bin} help ${topic ? `${topic}:` : ''}COMMAND`)
    if (topic) {
      this.out.log(`${this.config.bin} ${this.out.color.bold(topic)} commands: (get help with ${helpCmd})`)
    } else {
      this.out.log('Root commands:')
    }
    let helpLines = commands.map(c => this.buildHelpLine(c))
    this.out.log(renderList(helpLines))
    this.out.log()
  }

  buildHelp (c: ICommand): string {
    if (c.buildHelp) return c.buildHelp(this.config)
    let help = new deps.CLICommandHelp(this.config)
    return help.command(c)
  }

  buildHelpLine (c: ICommand): [string, ?string] {
    if (c.buildHelpLine) return c.buildHelpLine(this.config)
    let help = new deps.CLICommandHelp(this.config)
    return help.commandLine(c)
  }
}
