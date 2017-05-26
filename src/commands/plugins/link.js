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

  plugins: Plugins

  async run () {
    this.plugins = await (new Plugins(this.out)).init()
    await this.plugins.addLinkedPlugin(path.resolve(this.argv[0] || process.cwd()))
  }
}
