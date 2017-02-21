import Command from 'cli-engine-command'
import util from '../util'
import config from '../config'
import screen from 'cli-engine-command/lib/output/screen'

export default class extends Command {
  topic = 'help'
  description = 'display help'
  // variableArgs = true

  get plugins () { return require('../plugins') }

  async run () {
    const argv0 = config.bin
    let cmd = this.args.find(arg => !['help', '-h', '--help'].includes(arg))
    if (!cmd) return this.topics({argv0})
    let topicName = cmd.split(':')[0]
    let topic = this.plugins.topics[topicName]
    let matchedCommand = this.plugins.commands[cmd]
    if (!topic && !matchedCommand) throw new Error(`command ${cmd} not found`)
    if (!topic) topic = {name: topicName, fetch: () => { }}
    let Topic = topic.fetch()
    if (typeof Topic !== 'function') {
      Topic = class extends require('heroku-cli-command').Topic {}
      Topic.topic = topic.topic
      Topic.description = topic.description
    }
    let commands = this.plugins.commandList.filter(c => c.topic === topicName)
    topic = new Topic({flags: this.flags, commands})
    await topic.help({args: this.args, matchedCommand, argv0})
  }

  topics ({argv0}) {
    this.log(`Usage: ${argv0} COMMAND [--app APP] [command-specific-options]

Help topics, type ${this.color.cmd(argv0 + ' help TOPIC')} for more details:\n`)
    let topics = Object.keys(this.plugins.topics).map(t => this.plugins.topics[t])
    topics = topics.filter(t => !t.hidden)
    topics.sort(util.compare('topic'))
    topics = topics.map(t => [t.topic, t.description])
    this.log(this.renderList(topics))
    this.log()
  }

  renderList (items) {
    const S = require('string')
    const max = require('lodash.maxby')

    let maxLength = max(items, '[0].length')[0].length + 1
    let lines = items
      .map(i => [
        // left side
        ` ${S(i[0]).padRight(maxLength)}`,

        // right side
        this.linewrap(maxLength + 4, i[1])
      ])
      // join left + right side
      .map(i => i[1] ? `${i[0]} # ${i[1]}` : i[0])
    return lines.join('\n')
  }

  linewrap (length, s) {
    const linewrap = require('../lib/linewrap')
    return linewrap(length, screen.stdtermwidth, {
      skipScheme: 'ansi-color'
    })(s).trim()
  }
}
