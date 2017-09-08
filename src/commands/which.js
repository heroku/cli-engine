// @flow

import Command from 'cli-engine-command'
import Plugins from '../plugins'

export default class extends Command<*> {
  static topic = 'which'
  static description = 'show which plugin a command is from'
  static args = [
    {name: 'command'}
  ]
  static help = `Example:

    $ heroku which which
    === Plugin builtin
    type: builtin
    path: /home/selfuser/.local/share/heroku/client/node_modules/cli-engine/lib/command`

  plugins: Plugins

  async run () {
    this.plugins = new Plugins(this.out)
    const [command] = this.argv
    const plugin = await this.plugins.findPluginWithCommand(command)
    if (!plugin) throw new Error('not found')
    this.out.styledHeader(`Plugin ${plugin.name}`)
    this.out.styledObject({
      type: plugin.type,
      path: plugin.pluginPath.path
    }, ['type', 'path'])
  }
}
