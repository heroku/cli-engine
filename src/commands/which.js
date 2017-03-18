// @flow

import Command from 'cli-engine-command'
import Plugins from '../plugins'

export default class extends Command {
  static topic = 'which'
  static args = [
    {name: 'command'}
  ]

  plugins = new Plugins(this)

  async run () {
    const [command] = this.argv
    const plugin = this.plugins.list().find(p => p.findCommand(command))
    if (!plugin) throw new Error('not found')
    if (plugin.type === 'builtin') {
      this.log('builtin command')
    } else {
      this.log(`Command from ${plugin.type} plugin ${plugin.name}`)
    }
  }
}
