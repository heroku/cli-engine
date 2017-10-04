import cli from 'cli-ux'
import { Command } from 'cli-engine-command'

export default class Version extends Command {
  options = {
    description: 'show CLI version',
    aliases: ['-v', 'v', '--version', '--v'],
  }

  async run() {
    cli.log(this.config.userAgent)
  }
}
