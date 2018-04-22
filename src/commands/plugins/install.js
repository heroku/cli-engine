// @flow

import Command from 'cli-engine-command'
import Plugins from '../../plugins'
import {Hooks} from '../../hooks'

let examplePlugin = 'heroku-production-status'
let cli = 'heroku'
if (global.config) {
  cli = global.config.bin
  let pjson = global.config.pjson['cli-engine']
  if (pjson['help'] && pjson['help']['plugins']) {
    examplePlugin = Object.keys(pjson['help']['plugins'])[0]
  }
}

export default class PluginsInstall extends Command<*> {
  static topic = 'plugins'
  static command = 'install'
  static description = 'installs a plugin into the CLI'
  static help = `
  Example:
    $ ${cli} plugins:install ${examplePlugin}
  `
  static args = [
    {name: 'plugin', description: 'plugin to install'}
  ]
  plugins: Plugins

  async run () {
    this.plugins = new Plugins(this.config)
    const [plugin, tag = 'latest'] = this.parsePlugin(this.argv[0])
    if (!this.config.debug) this.out.action.start(`Installing plugin ${plugin}${tag === 'latest' ? '' : '@' + tag}`)
    await this.plugins.install(plugin, tag)
    const hooks = new Hooks({config: this.config})
    await hooks.run('update')
  }

  parsePlugin (input: string) {
    if (input.includes('/')) {
      input = input.slice(1)
      let [name, tag = 'latest'] = input.split('@')
      return ['@' + name, tag]
    } else {
      let [name, tag = 'latest'] = input.split('@')
      return [name, tag]
    }
  }
}
