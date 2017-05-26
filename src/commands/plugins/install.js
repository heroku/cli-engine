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
  plugins: Plugins

  async run () {
    this.plugins = await (new Plugins(this.out)).init()
    const [plugin, tag = 'latest'] = this.argv[0].split('@')
    if (!this.config.debug) this.out.action.start(`Installing plugin ${plugin}${tag === 'latest' ? '' : '@' + tag}`)
    await this.plugins.install(plugin, tag)
  }
}
