import {Command} from 'cli-engine-command'

export default class Version extends Command {
  options = {
    description: 'show CLI version',
    aliases: ['-v', 'v', '--version'],
  }

  async run () {
    this.cli.log(this.config.userAgent)
  }
}
