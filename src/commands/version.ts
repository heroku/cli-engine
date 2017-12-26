import { Command } from '@cli-engine/command'
import { cli } from 'cli-ux'

export default class Version extends Command {
  static description = 'show CLI version'
  static aliases = ['-v', '--version']

  async run() {
    cli.log(this.config.userAgent)
  }
}
