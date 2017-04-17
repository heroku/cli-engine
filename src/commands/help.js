// @flow

import Command, {type Arg, type Flag, Topic as TopicBase} from 'cli-engine-command'
import util from '../util'
import {stdtermwidth} from 'cli-engine-command/lib/output/screen'
import Plugins from '../plugins'

export default class Help extends Command {
  static topic = 'help'
  static description = 'display help'
  static variableArgs = true

  plugins: Plugins

  async run () {
    this.plugins = new Plugins(this.out)
    let cmd = this.argv.find(arg => !['-h', '--help'].includes(arg))
    if (!cmd) return this.topics()
    let Topic = this.plugins.findTopic(cmd)
    let matchedCommand = this.plugins.findCommand(cmd)
    if (!Topic && !matchedCommand) throw new Error(`command ${cmd} not found`)
    if (!Topic) Topic = TopicHelpPresenter
    let commands = this.plugins.commandsForTopic(Topic.topic)
    await new Topic(commands, this.out).help(this.argv, matchedCommand)
  }

  topics () {
    this.out.log(`Usage: ${this.config.bin} COMMAND [--app APP] [command-specific-options]

Help topics, type ${this.out.color.cmd(this.config.bin + ' help TOPIC')} for more details:\n`)
    let topics = this.plugins.topics.filter(t => !t.hidden)
    topics.sort(util.compare('topic'))
    topics = topics.map(t => [t.topic, t.description])
    this.out.log(this.renderList(topics))
    this.out.log()
  }

  renderList (items: [string, ?string][]): string {
    const S = require('string')
    const max = require('lodash.maxby')

    let maxLength = max(items, '[0].length')[0].length + 1
    let lines = items
      .map(i => [
        // left side
        ` ${S(i[0]).padRight(maxLength)}`,

        // right side
        this.linewrap(maxLength + 4, i[1] || '')
      ])
      // join left + right side
      .map(i => i[1] ? `${i[0]} # ${i[1]}` : i[0])
    return lines.join('\n')
  }

  linewrap (length: string, s: string): string {
    const linewrap = require('../linewrap')
    return linewrap(length, stdtermwidth, {
      skipScheme: 'ansi-color'
    })(s).trim()
  }
}

class TopicHelpPresenter extends TopicBase {
  async help (args: string[], matchedCommand?: ?Class<Command<*>>) {
    if (matchedCommand) this.commandHelp(matchedCommand)
    console.log(this.constructor, args)
    if (args.slice(0, 2).includes(this.constructor.topic)) this.listCommandsHelp()
  }

  listCommandsHelp () {
    let commands = this.commands.filter(c => !c.hidden).map(c => [this.usage(c), c.description])
    if (commands.length === 0) return
    this.out.log(`${this.out.config.bin} ${this.constructor.topic} commands: (${this.out.color.cmd(this.out.config.bin + ' help ' + this.constructor.topic + ':COMMAND')} for details)\n`)
    this.out.log(this.renderList(commands))
    this.out.log()
  }

  commandHelp (command: Class<Command<*>>) {
    let usage = `${this.out.config.bin} ${this.usage(command)}`
    this.out.log(`Usage: ${this.out.color.cmd(usage)}\n`)
    if (command.description) this.out.log(`${command.description.trim()}\n`)
    let flags = Object.keys(command.flags || {}).map(f => [f, command.flags[f]]).filter(f => !f[1].hidden)
    if (flags.length) this.out.log(`${this.renderFlags(flags)}\n`)
    if (command.help) this.out.log(`${command.help.trim()}\n`)
  }

  renderArg (arg: Arg) {
    let name = arg.name.toUpperCase()
    if (arg.required !== false && arg.optional !== true) return `${name}`
    else return `[${name}]`
  }

  renderFlags (flags: [string, Flag<*>][]) {
    flags.sort((a, b) => {
      if (a[1].char && !b[1].char) return -1
      if (b[1].char && !a[1].char) return 1
      if (a[0] < b[0]) return -1
      return b[0] < a[0] ? 1 : 0
    })
    return this.renderList(flags.map(([name, f]) => {
      let label = []
      if (f.char) label.push(`-${f.char}`)
      if (name) label.push(` --${name}`)
      let usage = f.hasValue ? ` ${name.toUpperCase()}` : ''
      let description = f.description || ''
      if (f.required || f.optional === false) description = `(required) ${description}`
      return [label.join(',').trim() + usage, description]
    }))
  }

  usage (command: Class<Command<*>>) {
    if (command.usage) return command.usage.trim()
    let cmd = command.command ? `${command.topic}:${command.command}` : command.topic
    if (!command.args) return cmd.trim()
    let args = command.args.map(this.renderArg)
    return `${cmd} ${args.join(' ')}`.trim()
  }

  renderList (items: [string, ?string][]): string {
    const S = require('string')
    const max = require('lodash.maxby')

    let maxLength = max(items, '[0].length')[0].length + 1
    let lines = items
      .map(i => {
        let left = ` ${i[0]}`
        let right = i[1]
        if (!right) return left
        left = `${S(left).padRight(maxLength)}`
        right = this.linewrap(maxLength + 4, right)
        return `${left} # ${right}`
      })
    return lines.join('\n')
  }

  linewrap (length: number, s: string) {
    const linewrap = require('../linewrap')
    return linewrap(length, stdtermwidth, {
      skipScheme: 'ansi-color'
    })(s).trim()
  }
}
