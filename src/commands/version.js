// @flow

import Command from 'cli-engine-command'

export default class Version extends Command {
  static topic = 'version'
  static description = 'show CLI version'
  static aliases = ['-v', 'v', '--version']

  async run () {
    let channel = this.config.channel === 'stable' ? '' : ` ${this.config.channel}`
    this.log(`${this.config.name}/${this.config.version}${channel} (${process.platform}-${process.arch}) node-${process.version}`)
  }
}
