// @flow

import Command from 'cli-engine-command'
import {compare} from '../util'
import {stdtermwidth} from 'cli-engine-command/lib/output/screen'
import Plugins from '../plugins'
import type Plugin from '../plugins/plugin'
import uniqby from 'lodash.uniqby'

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
  const linewrap = require('../linewrap')
  return linewrap(length, stdtermwidth, {
    skipScheme: 'ansi-color'
  })(s).trim()
}

export default class Help extends Command {
  static topic = 'help'
  static description = 'display help'
  static variableArgs = true

  plugins: Plugins

  async run () {
    this.plugins = new Plugins(this.out)
    await this.plugins.load()
    let cmd = this.argv.find(arg => !['-h', '--help'].includes(arg))
    if (!cmd) {
      return this.topics()
    }

    const topic = await this.plugins.findTopic(cmd)
    let matchedCommand = await this.plugins.findCommand(cmd)
    let matchedNamespace = this.plugins.findNamespaced(cmd)

    if (!topic && !matchedCommand && !matchedNamespace.length) {
      throw new Error(`command ${cmd} not found`)
    }

    if (matchedCommand) {
      const splitCmd = cmd.split(':')
      if (this.plugins.findNamespaced(splitCmd[0]).length) {
        // if namespaced, update topic name for proper help display
        matchedCommand.topic = splitCmd.slice(0, 2).join(':')
      }
      this.out.log(matchedCommand.buildHelp(this.config))
    }

    if (topic) {
      this.listCommandsHelp(cmd, await this.plugins.commandsForTopic(topic.topic))
    }

    if (!matchedCommand && matchedNamespace.length) {
      this.listNamespaceHelp(matchedNamespace)
    }
  }

  topics () {
    let color = this.out.color
    this.out.log(`${color.bold('Usage:')} ${this.config.bin} COMMAND

Help topics, type ${this.out.color.cmd(this.config.bin + ' help TOPIC')} for more details:\n`)
    let topics = this.plugins.topics.filter(t => !t.hidden).filter(t => !t.namespace)
    let ns = uniqby(this.plugins.topics.map(t => t.namespace)).filter(t => t)
    topics = topics.map(t => (
      [
        t.topic,
        t.description ? this.out.color.dim(t.description) : null
      ]
    )).concat(ns.map(t => (
      [
        t,
        this.out.color.dim(`topics for ${t}`)
      ]
    )))
    topics.sort()
    this.out.log(renderList(topics))
    this.out.log()
  }

  listNamespaceHelp (plugins: Plugin[]) {
    let namespace = plugins[0].namespace || ''
    this.out.log(`Usage: ${this.config.bin} ${namespace}:TOPIC\n`)
    for (var i = 0; i < plugins.length; i++) {
      let plugin = plugins[i]
      if (plugin.topics) {
        this.out.log(renderList(plugin.topics.filter(t => !t.hidden).map(t => (
          [
            plugin.namespace ? `${plugin.namespace}:${t.topic}` : t.topic,
            t.description ? this.out.color.dim(t.description) : null
          ]
        ))))
      }
    }
  }

  listCommandsHelp (topic: string, commands: Class<Command<*>>[]) {
    commands = commands.filter(c => !c.hidden)
    if (commands.length === 0) return
    commands.sort(compare('command'))
    let hasNamespace = this.plugins.findNamespaced(topic.split(':')[0]).length
    let helpCmd = this.out.color.cmd(`${this.config.bin} help ${topic}:COMMAND`)
    this.out.log(`${this.config.bin} ${this.out.color.bold(topic)} commands: (get help with ${helpCmd})`)
    this.out.log(renderList(commands.map(c => {
      // if namespaced, update topic name for proper help display
      // b/c these helpers are in cli-engine-command
      if (hasNamespace) c.topic = topic
      return c.buildHelpLine(this.config)
    })))
    this.out.log()
  }
}
