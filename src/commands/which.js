// @flow

import Command from 'cli-engine-command'
import Plugins from '../plugins'

export default class extends Command {
  static topic = 'which'
  static args = [
    {name: 'command'}
  ]

  findPlugin (cmd: string) {
    const plugins = new Plugins(this.config)
    for (let plugin of plugins.list()) {
      if (plugin.findCommand(this.args['command'])) {
        return plugin
      }
    }
  }

  async run () {
    const plugin = this.findPlugin(this.args['command'])
    if (!plugin) throw new Error('not found')
    switch (plugin.type) {
      case 'builtin':
        this.log('builtin command')
        break
      case 'link':
      case 'core':
      case 'user':
        this.log(`Command from ${plugin.type} plugin ${plugin.name}`)
        break
      default:
        throw new Error('not found')
    }
  }
}
