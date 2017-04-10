// @flow

import Command from 'cli-engine-command'
import Plugins from '../../plugins'

export default class PluginsInstall extends Command {
  static topic = 'plugins'
  static command = 'install'
  static description = 'installs a plugin into the CLI'
  static help = `
  Example:
    $ heroku plugins:install heroku-production-status
  `
  static args = [
    {name: 'plugin'}
  ]
  plugins = new Plugins(this)

  async run () {
    const [plugin, tag = 'latest'] = this.argv[0].split('@')
    if (!this.config.debug) this.action.start(`Installing plugin ${plugin}${tag === 'latest' ? '' : '@' + tag}`)
    await this.plugins.install(plugin, tag)
  }
}
