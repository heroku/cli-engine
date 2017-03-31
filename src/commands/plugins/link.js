// @flow

import Command from 'cli-engine-command'
import Plugins from '../../plugins'
import path from 'path'

export default class PluginsLink extends Command {
  static topic = 'plugins'
  static command = 'link'
  static args = [
    {name: 'path', optional: true}
  ]

  plugins = new Plugins(this)

  async run () {
    debugger
    await this.plugins.addLinkedPlugin(path.resolve(this.argv[0] || process.cwd()))
  }
}
