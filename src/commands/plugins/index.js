// @flow

import Command, {BooleanFlag} from 'cli-engine-command'
import util from '../../util'
import Plugins from '../../plugins'

export default class extends Command {
  static topic = 'plugins'
  static flags = {core: BooleanFlag()}

  plugins: Plugins = new Plugins(this)

  async run () {
    let plugins = this.plugins.list()
    plugins = plugins.filter(p => p.type !== 'builtin')
    plugins.sort(util.compare('name'))
    if (!this.flags.core) plugins = plugins.filter(p => p.type !== 'core')
    if (!plugins.length) this.warn('no plugins installed')
    for (let plugin of plugins) {
      let output = `${plugin.name} ${plugin.version}`
      if (plugin.type !== 'user') output += ` (${plugin.type})`
      else if (plugin.options.tag !== 'latest') output += ` (${plugin.options.tag})`
      this.log(output)
    }
  }
}
