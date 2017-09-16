import { Command } from 'cli-engine-command'
import { Plugins } from '../../plugins'
// import {Hooks} from '../../hooks'

export default class PluginsInstall extends Command {
  options = {
    description: 'installs a plugin into the CLI',
    args: [{ name: 'plugin', description: 'plugin to install', required: true }],
    help: `
  Example:
    $ heroku plugins:install heroku-production-status
  `,
  }

  plugins: Plugins
  // hooks: Hooks

  async run() {
    // this.hooks = new Hooks({config: this.config})
    this.plugins = new Plugins({ config: this.config })
    const [plugin, tag = 'latest'] = this.argv[0].split('@')
    // await this.hooks.run('plugins:preinstall', {plugin, tag})
    if (!this.config.debug) this.cli.action.start(`Installing plugin ${plugin}${tag === 'latest' ? '' : '@' + tag}`)
    if ((await this.plugins.user.list()).find(p => p.name === plugin && p.tag === tag)) {
      throw new Error(`${plugin} is already installed`)
    }
    await this.plugins.user.install(plugin, tag)
  }
}
