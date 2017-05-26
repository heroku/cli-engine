// @flow

import type {Config} from 'cli-engine-config'
import type Output from 'cli-engine-command/lib/output'
import Plugins from './plugins'

export default class NotFound {
  argv: string[]
  config: Config
  out: Output

  constructor (output: Output, argv: string[]) {
    this.argv = argv
    this.out = output
    this.config = output.config
  }

  async allCommands (): Promise<string[]> {
    let plugins = await (new Plugins(this.out)).init()
    return plugins.commands.reduce((commands, c) => {
      return commands.concat([c.id]).concat(c.aliases || [])
    }, [])
  }

  async closest (cmd: string) {
    const LST = require('levenshtein')
    let max
    for (let c of await this.allCommands()) {
      if (!c) continue
      let d = new LST(cmd, c)
      if (!max || d.distance < max[1]) max = [c, d.distance]
    }
    return max ? max[0] : null
  }

  async run () {
    let closest = this.closest(this.argv[1])
    let binHelp = `${this.config.bin} help`

    let perhaps = closest ? `Perhaps you meant ${this.out.color.yellow(closest)}\n` : ''
    this.out.error(`${this.out.color.yellow(this.argv[1])} is not a ${this.config.bin} command.
${perhaps}Run ${this.out.color.cmd(binHelp)} for a list of available commands.`, 127)
  }
}
