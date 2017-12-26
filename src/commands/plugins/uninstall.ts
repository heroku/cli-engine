import { Command } from '@cli-engine/command'
import { cli } from 'cli-ux'

import { Plugins } from '../../plugins'

const g = global as any
const bin: string = g.config ? g.config.bin : 'heroku'

export default class PluginsUninstall extends Command {
  static topic = 'plugins'
  static command = 'uninstall'
  static args = [{ name: 'plugin', description: 'plugin name to uninstall', required: true }]
  static aliases = ['plugins:unlink']
  static description = 'uninstalls or unlinks a plugin'
  static help = `Example:
    $ ${bin} plugins:uninstall heroku-accounts
`

  plugins: Plugins

  async run() {
    const [plugin] = this.argv
    cli.action.start(`Uninstalling ${plugin}`)
    this.plugins = new Plugins(this.config)
    await this.plugins.uninstall(plugin)
  }
}
