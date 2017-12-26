import { Command } from '@cli-engine/command'
import cli from 'cli-ux'
import { CommandManager } from '../command'

export default class extends Command {
  static topic = 'which'
  static description = 'show which plugin a command is from'
  static args = [{ name: 'command', required: true }]

  cm: CommandManager

  async run() {
    this.cm = new CommandManager(this.config)
    const id = this.argv[0]
    const command = await this.cm.findCommand(id, true)
    const plugin = command.plugin!
    cli.styledHeader(`Plugin ${plugin.name}`)
    cli.styledObject(plugin, ['version', 'type', 'path'])
  }
}
