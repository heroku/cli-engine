// @flow

import Command from 'cli-engine-command'
import util from '../util'
import {stdtermwidth} from 'cli-engine-command/lib/output/screen'
import Plugins from '../plugins'

export default class Help extends Command {
  static topic = 'help'
  static description = 'display help'
  static variableArgs = true

  plugins: Plugins

  async run () {
    this.plugins = new Plugins(this.config)
    let cmd = this.argv.find(arg => !['help', '-h', '--help'].includes(arg))
    if (!cmd) return this.topics()
    let Topic = this.plugins.findTopic(cmd)
    let matchedCommand = this.plugins.findCommand(cmd)
    if (!Topic) throw new Error(`command ${cmd} not found`)
    let commands = this.plugins.commandsForTopic(Topic.topic)
    await new Topic(commands, this.config).help(this.argv, matchedCommand)
  }

  topics () {
    this.log(`Usage: ${this.config.bin} COMMAND [--app APP] [command-specific-options]

Help topics, type ${this.color.cmd(this.config.bin + ' help TOPIC')} for more details:\n`)
    let topics = this.plugins.topics.filter(t => !t.hidden)
    topics.sort(util.compare('topic'))
    topics = topics.map(t => [t.topic, t.description])
    this.log(this.renderList(topics))
    this.log()
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
