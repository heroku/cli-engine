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

  plugins = new Plugins(this)

  async run () {
    const [plugin] = this.argv
    await this.plugins.uninstall(plugin)
  }
}
