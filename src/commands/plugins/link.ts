import cli from 'cli-ux'
import { Command } from 'cli-engine-command'
// import {LinkPlugins} from '../../plugins'
// import path from 'path'

let cliBin = 'heroku'
let globalConfig = (<any>global).config
if (globalConfig) {
  cliBin = globalConfig.bin
}
export default class PluginsLink extends Command {
  options = {
    description: 'links a local plugin to the CLI for development',
    help: `Example:
    $ ${cliBin} plugins:link .
    Installing dependencies for /Users/dickeyxxx/src/github.com/${cliBin}/${cliBin}-status... done
    Running prepare script for /Users/dickeyxxx/src/github.com/${cliBin}/${cliBin}-status... done`,
    args: [{ name: 'path', optional: true, description: 'local file path to plugin root' }],
  }

  async run() {
    cli.log('TODO')
    // this.plugins = new Plugins(this.config)
    // let p = path.resolve(this.argv[0] || process.cwd())
    // this.out.action.start(`Linking ${p}`)
    // await this.plugins.addLinkedPlugin(p)
  }
}
