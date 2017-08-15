// @flow

import Command from 'cli-engine-command'
import Plugins from '../../plugins'

export default class PluginsUninstall extends Command {
  static topic = 'plugins'
  static command = 'uninstall'
  static args = [
    {name: 'plugin', description: 'plugin name to uninstall'}
  ]
  static aliases = ['plugins:unlink']
  static description = 'uninstalls or unlinks a plugin'
  static help = `Example:
    $ heroku plugins:uninstall heroku-accounts
`

  plugins: Plugins

  async run () {
    this.plugins = new Plugins({output: this.out})
    const [plugin] = this.argv
    await this.plugins.uninstall(plugin)
  }
}
