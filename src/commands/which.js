// @flow

import Command from 'cli-engine-command'
import Plugins from '../plugins'

export default class extends Command {
  static topic = 'which'
  static args = [
    {name: 'command'}
  ]

  plugins: Plugins

  async run () {
    this.plugins = await (new Plugins(this.out)).init()
    const [command] = this.argv
    const plugin = this.plugins.list().find(p => p.findCommand(command))
    if (!plugin) throw new Error('not found')
    if (plugin.type === 'builtin') {
      this.out.log('builtin command')
    } else {
      this.out.log(`Command from ${plugin.type} plugin ${plugin.name}`)
    }
  }
}
