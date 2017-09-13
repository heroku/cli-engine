import {Command} from 'cli-engine-command'
import {CommandManager} from '../command_managers'

export default class extends Command {
  description = 'show which plugin a command is from'
  parse = {
    args: [
      {name: 'command'}
    ]
  }

  async run () {
    const commandManager = new CommandManager(this.config)
    const [id] = this.argv
    const command = await commandManager.findCommand(id)
    if (!command) throw new Error('not found')
    if (!command.__config.plugin) throw new Error('command not in a plugin')
    this.cli.styledHeader(`Plugin ${command.__config.plugin.name}`)
    // this.cli.styledObject({
    //   type: command.plugin.type,
    //   path: command.plugin.pluginPath.path
    // }, ['type', 'path'])
  }
}
