// @flow

import type {Config} from 'cli-engine-config'
import type Output from 'cli-engine-command/lib/output'
import Plugins from './plugins'

export default class NotFound {
  argv: string[]
  config: Config
  out: Output
  plugins: Plugins

  constructor (output: Output, argv: string[]) {
    this.argv = argv
    this.out = output
    this.config = output.config
    this.plugins = new Plugins(output)
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

  async isTopic (name: string) : Promise<boolean> {
    let t = await this.plugins.findTopic(name)
    return !!t
  }

  async run () {
    await this.plugins.load()
    let id = this.argv[1]
    let closest
    let binHelp
    if (await this.isTopic(id)) {
      binHelp = `${this.config.bin} help ${id}`
    } else {
      closest = this.closest(id)
      binHelp = `${this.config.bin} help`
    }

    let perhaps = closest ? `Perhaps you meant ${this.out.color.yellow(closest)}\n` : ''
    this.out.error(`${this.out.color.yellow(this.argv[1])} is not a ${this.config.bin} command.
${perhaps}Run ${this.out.color.cmd(binHelp)} for a list of available commands.`, 127)
  }
}
