import { Command, flags } from '@cli-engine/command'
import { cli } from 'cli-ux'

import { Hooks } from '../../hooks'
import { Plugins } from '../../plugins'

let examplePlugin = 'heroku-production-status'
let bin = 'heroku'
const g = global as any
if (g.config) {
  bin = g.config.bin
  let pjson = g.config.pjson['cli-engine']
  if (pjson.help && pjson.help.plugins) {
    examplePlugin = Object.keys(pjson.help.plugins)[0]
  }
}

export default class PluginsInstall extends Command {
  static topic = 'plugins'
  static command = 'install'
  static description = 'installs a plugin into the CLI'
  static usage = 'plugins:install PLUGIN...'
  static help = `
  Example:
    $ ${bin} plugins:install ${examplePlugin}
  `
  static variableArgs = true
  static args = [{ name: 'plugin', description: 'plugin to install', required: true }]
  static flags: flags.Input = {
    force: flags.boolean({ char: 'f' }),
  }

  async run() {
    const plugins = new Plugins(this.config)
    for (let plugin of this.argv) {
      const [name, tag = 'latest'] = plugin.split('@')
      cli.action.start(`Installing plugin ${name}${tag === 'latest' ? '' : '@' + tag}`)
      await plugins.install({ type: 'user', name, tag, force: this.flags.force })
      cli.action.stop()
    }
    const hooks = new Hooks(this.config)
    await hooks.run('update')
  }
}
