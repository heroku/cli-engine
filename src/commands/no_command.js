// @flow

import Command from 'cli-engine-command'

export default class extends Command {
  // variableArgs = true

  async run () {
    throw new Error(`${this.color.yellow(this.argv[1])} is not a heroku command.
Perhaps you meant ????
Run ${this.color.cmd('heroku help')} for a list of available commands.`)
  }
}

