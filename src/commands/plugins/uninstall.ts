import { Command } from 'cli-engine-command'
// import {Plugins} from '../../plugins'

const globalConfig = (<any>global).config
const cliBin = globalConfig ? globalConfig.bin : 'heroku'

export default class PluginsUninstall extends Command {
  options = {
    args: [{ name: 'plugin', description: 'plugin name to uninstall' }],
    description: 'uninstalls or unlinks a plugin',
    help: `Example:
    $ ${cliBin} plugins:uninstall ${cliBin}-accounts
`,
  }
  // static aliases = ['plugins:unlink']

  async run() {
    // this.plugins = new Plugins(this.config)
    // const [plugin] = this.argv
    // await this.plugins.uninstall(plugin)
  }
}
