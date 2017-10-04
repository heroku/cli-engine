// @flow

import type {Config} from 'cli-engine-config'
import Plugins from './plugins'
import {CLI} from 'cli-ux'
import {color} from 'cli-engine-command/lib/color'

export class NotFound {
  argv: string[]
  config: Config
  cli: CLI
  plugins: Plugins

  constructor (config: Config, argv: string[]) {
    this.argv = argv
    this.config = config
    this.cli = new CLI({mock: config.mock})
    this.plugins = new Plugins(config)
  }

  allCommands (): string[] {
    return this.plugins.commands.reduce((commands, c) => {
      return commands.concat([c.id]).concat(c.aliases || [])
    }, [])
  }

  closest (cmd: string) {
    const DCE = require('string-similarity')
    return DCE.findBestMatch(cmd, this.allCommands()).bestMatch.target
  }

  async isValidTopic (name: string): Promise<boolean> {
    let t = await this.plugins.findTopic(name)
    return !!t
  }

  async run () {
    await this.plugins.load()

    let closest
    let binHelp = `${this.config.bin} help`
    let id = this.argv[1]
    let idSplit = id.split(':')
    if (await this.isValidTopic(idSplit[0])) {
      // if valid topic, update binHelp with topic
      binHelp = `${binHelp} ${idSplit[0]}`
      // if topic:COMMAND present, try closest for id
      if (idSplit[1]) closest = this.closest(id)
    } else {
      closest = this.closest(id)
    }

    let perhaps = closest ? `Perhaps you meant ${color.yellow(closest)}\n` : ''
    this.cli.error(`${color.yellow(this.argv[1])} is not a ${this.config.bin} command.
${perhaps}Run ${color.cmd(binHelp)} for a list of available topics.`, {exitCode: 127})
  }
}
