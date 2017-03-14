// @flow

import {Base} from 'cli-engine-command'
import Plugins from './plugins'

export default class NotFound extends Base {
  allCommands (): string[] {
    let plugins = new Plugins(this.config)
    return plugins.commands.reduce((commands, c) => {
      return commands.concat([c.id]).concat(c.aliases || [])
    }, [])
  }

  closest (cmd: string) {
    const LST = require('levenshtein')
    let max
    for (let c of this.allCommands()) {
      if (!c) continue
      let d = new LST(cmd, c)
      if (!max || d.distance < max[1]) max = [c, d.distance]
    }
    return max ? max[0] : null
  }

  async run () {
    let closest = this.closest(this.config.argv[1])

    let perhaps = closest ? `Perhaps you meant ${this.color.yellow(closest)}\n` : ''
    this.error(`${this.color.yellow(this.config.argv[1])} is not a heroku command.
${perhaps}Run ${this.color.cmd('heroku help')} for a list of available commands.`, 127)
  }
}
