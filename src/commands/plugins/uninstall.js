// @flow

import Command from 'cli-engine-command'
import Plugins from '../../plugins'

export default class PluginsUninstall extends Command {
  static topic = 'plugins'
  static command = 'uninstall'
  static args = [
    {name: 'plugin'}
  ]
  static aliases = ['plugins:unlink']

  plugins: Plugins

  async run () {
    this.plugins = await (new Plugins(this.out)).init()
    const [plugin] = this.argv
    await this.plugins.uninstall(plugin)
  }
}
