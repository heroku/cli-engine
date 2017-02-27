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

  async run () {
    const plugins = new Plugins(this.config)
    await plugins.install(this.args.plugin)
  }
}
