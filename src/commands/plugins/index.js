// @flow

import Command, {flags} from 'cli-engine-command'
import util from '../../util'
import Plugins from '../../plugins'

export default class extends Command {
  static topic = 'plugins'
  static flags = {core: flags.boolean()}

  async run () {
    let plugins = new Plugins(this.out).list()
    plugins = plugins.filter(p => p.type !== 'builtin')
    plugins.sort(util.compare('name'))
    if (!this.flags.core) plugins = plugins.filter(p => p.type !== 'core')
    if (!plugins.length) this.out.warn('no plugins installed')
    for (let plugin of plugins) {
      let output = `${plugin.name} ${plugin.version}`
      if (plugin.type !== 'user') output += ` (${plugin.type})`
      else if (plugin.tag !== 'latest') output += ` (${String(plugin.tag)})`
      this.out.log(output)
    }
  }
}
