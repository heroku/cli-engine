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

  async run () {
    const plugins = new Plugins(this.config)
    await plugins.uninstall(this.args.plugin)
  }
}
