// @flow

import Command from 'cli-engine-command'

export default class Version extends Command<*> {
  static topic = 'version'
  static description = 'show CLI version'
  static aliases = ['-v', 'v', '--version', '--v']

  async run () {
    this.out.log(this.config.userAgent)
  }
}
