// @flow

import Command from 'cli-engine-command'
import util from '../../util'
import Plugins from '../../plugins'

export default class extends Command {
  static topic = 'plugins'
  static flags = [
    {name: 'core', description: 'show core plugins'}
  ]

  async run () {
    let plugins = new Plugins(this.config)
    plugins = plugins.list()
    plugins = plugins.filter(p => p.type !== 'builtin')
    plugins.sort(util.compare('name'))
    if (!this.flags.core) plugins = plugins.filter(p => p.type !== 'core')
    if (!plugins.length) this.warn('no plugins installed')
    for (let plugin of plugins) {
      let output = `${plugin.name} ${plugin.version}`
      if (plugin.type !== 'user') output += ` (${plugin.type})`
      this.log(output)
    }
  }
}
