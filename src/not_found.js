// @flow

import {Base} from 'cli-engine-command'

class NotFound extends Base {
  async run () {
    throw new Error(`${this.color.yellow(this.config.argv[1])} is not a heroku command.
Perhaps you meant ????
Run ${this.color.cmd('heroku help')} for a list of available commands.`)
  }
}

export default (config: Config) => new NotFound(config).run()
