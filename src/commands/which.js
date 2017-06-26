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
    this.plugins = new Plugins(this.out)
    const [command] = this.argv
    const plugins = await this.plugins.list()
    const plugin = plugins.findPluginWithCommand(command)
    if (!plugin) throw new Error('not found')
    if (plugin.type === 'builtin') {
      this.out.log('builtin command')
    } else {
      this.out.log(`Command from ${plugin.type} plugin ${plugin.name}`)
    }
  }
}
