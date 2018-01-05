import { cli } from 'cli-ux'

import Command from '../base'

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

  async run() {
    const [plugin] = this.argv
    cli.action.start(`Uninstalling ${plugin}`)
    await this.config.plugins.uninstall(plugin)
  }
}
