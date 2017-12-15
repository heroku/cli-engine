import { Command } from 'cli-engine-command'
import { Plugins } from '../../plugins'

const g = global as any
const bin: string = g.config ? g.config.bin : 'heroku'

export default class PluginsUninstall extends Command {
  static topic = 'plugins'
  static command = 'uninstall'
  static args = [{ name: 'plugin', description: 'plugin name to uninstall' }]
  static aliases = ['plugins:unlink']
  static description = 'uninstalls or unlinks a plugin'
  static help = `Example:
    $ ${bin} plugins:uninstall heroku-accounts
`

  plugins: Plugins

  async run() {
    this.plugins = new Plugins({config: this.config})
    const [plugin] = this.argv
    await this.plugins.uninstall(plugin)
  }
}
