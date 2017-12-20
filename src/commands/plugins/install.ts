import { Command, flags, IBooleanFlag } from 'cli-engine-command'
import { Plugins } from '../../plugins'
import { Hooks } from '../../hooks'
import { cli } from 'cli-ux'

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
  static args = [{ name: 'plugin', description: 'plugin to install' }]
  static flags = {
    force: flags.boolean({ char: 'f' }) as IBooleanFlag,
  }

  async run() {
    const plugins = new Plugins({ config: this.config })
    await plugins.init()
    const [plugin, tag = 'latest'] = this.argv[0].split('@')
    if (!this.config.debug) cli.action.start(`Installing plugin ${plugin}${tag === 'latest' ? '' : '@' + tag}`)
    await plugins.install({ type: 'user', name: plugin, tag, force: this.flags.force })
    const hooks = new Hooks(this.config)
    await hooks.run('update')
  }
}
