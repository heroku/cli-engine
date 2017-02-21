// @flow

import Command from 'heroku-cli-command'
import config from '../config'

export default class extends Command {
  static topic = 'version'
  static description = 'show CLI version'
  static aliases = ['-v', 'v', '--version']

  async run () {
    if (process.env.HEROKU_DEV) this.log(`HEROKU_DEV=${process.env.HEROKU_DEV}`)
    let channel = config.channel === 'stable' ? '' : ` ${config.channel}`
    this.log(`${config.name}/${config.version}${channel} (${process.platform}-${process.arch}) node-${process.version}`)
  }
}
