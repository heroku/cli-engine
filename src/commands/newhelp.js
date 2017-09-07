// @flow

import Command from 'cli-engine-command'
// import {compare} from '../util'
import {stdtermwidth} from 'cli-engine-command/lib/output/screen'
import {Dispatcher} from '../dispatcher'

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

export default class Help extends Command<*> {
  static topic = 'help'
  static description = 'display help'
  static variableArgs = true

  async run () {
    await this.topics()
  }

  async topics () {
    let dispatcher = new Dispatcher(this.config)
    let topics = await dispatcher.listTopics()
    // let topics = [
    //   [
    //     'topica',
    //     'desc'
    //   ]
    // ]
    topics.sort()
    this.out.log(renderList(topics.map(t => [
      t,
      'desc'
    ])))
    this.out.log()
  }
}
