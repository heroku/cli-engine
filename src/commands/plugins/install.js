// @flow

import Command from 'cli-engine-command'
import Plugins from '../../plugins'
import {Hooks} from '../../hooks'

export default class PluginsInstall extends Command<*> {
  static topic = 'plugins'
  static command = 'install'
  static description = 'installs a plugin into the CLI'
  static help = `
  Example:
    $ heroku plugins:install heroku-production-status
  `
  static args = [
    {name: 'plugin', description: 'plugin to install'}
  ]
  plugins: Plugins
  hooks: Hooks

  async run () {
    this.hooks = new Hooks({config: this.config})
    this.plugins = new Plugins(this.out)
    const [plugin, tag = 'latest'] = this.argv[0].split('@')
    await this.hooks.run('plugins:preinstall', {plugin, tag})
    if (!this.config.debug) this.out.action.start(`Installing plugin ${plugin}${tag === 'latest' ? '' : '@' + tag}`)
    await this.plugins.install(plugin, tag)
  }
}
