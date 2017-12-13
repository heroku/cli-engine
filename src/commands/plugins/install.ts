import {Command} from 'cli-engine-command'
import {Plugins} from '../../plugins'
import {Hooks} from '../../hooks'
import {cli} from 'cli-ux'

let examplePlugin = 'heroku-production-status'
let bin = 'heroku'
const g = global as any
if (g.config) {
  bin = g.config.bin
  let pjson = g.config.pjson['cli-engine']
  if (pjson['help'] && pjson['help']['plugins']) {
    examplePlugin = Object.keys(pjson['help']['plugins'])[0]
  }
}

export default class PluginsInstall extends Command {
  static topic = 'plugins'
  static command = 'install'
  static description = 'installs a plugin into the CLI'
  static help = `
  Example:
    $ ${bin} plugins:install ${examplePlugin}
  `
  static args = [
    {name: 'plugin', description: 'plugin to install'}
  ]
  plugins: Plugins

  async run () {
    this.plugins = new Plugins(this.config)
    console.dir(this.argv)
    const [plugin, tag = 'latest'] = this.argv[0].split('@')
    if (!this.config.debug) cli.action.start(`Installing plugin ${plugin}${tag === 'latest' ? '' : '@' + tag}`)
    await this.plugins.user.install(plugin, tag)
    const hooks = new Hooks(this.config)
    await hooks.run('update')
  }
}
