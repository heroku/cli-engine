// @flow

import Command from 'cli-engine-command'
import Yarn from '../../yarn'
import Plugins from '../plugins'

export default class PluginsUninstall extends Command {
  static topic = 'plugins'
  static command = 'uninstall'
  static args = [
    {name: 'plugin'}
  ]
  static aliases = ['plugins:unlink']

  async run () {
    const yarn = new Yarn(this.config)
    const plugins = new Plugins(this.config)

    if (!this.debugging) this.action.start(`Uninstalling plugin ${this.args.plugin}`)
    if (this.fs.existsSync(plugins.pluginPath(this.args.plugin))) {
      await yarn.exec('remove', this.args.plugin)
    } else {
      plugins.removeLinkedPlugin(this.args.plugin)
    }
    plugins.clearCache(dirs.userPlugin(this.args.plugin))
  }

  get plugins () { return require('../../plugins') }
}
