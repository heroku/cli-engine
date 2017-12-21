import { Command } from 'cli-engine-command'
import cli from 'cli-ux'
import { Plugins } from '../plugins'

export default class extends Command {
  static topic = 'which'
  static description = 'show which plugin a command is from'
  static args = [{ name: 'command', required: true }]

  plugins: Plugins

  async run() {
    this.plugins = new Plugins({ config: this.config })
    const id = this.argv[0]
    const command = await this.plugins.findCommand(id, { must: true })
    const plugin = command.plugin!
    cli.styledHeader(`Plugin ${plugin.name}`)
    cli.styledObject(plugin, ['version', 'type', 'path'])
  }
}
