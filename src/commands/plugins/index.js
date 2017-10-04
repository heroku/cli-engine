// @flow

import Command, {flags} from 'cli-engine-command'
import {compare} from '../../util'
import Plugins from '../../plugins'

let examplePlugins = {
  'heroku-ci': {version: '1.8.0'},
  'heroku-cli-status': {version: '3.0.10', type: 'link'},
  'heroku-fork': {version: '4.1.22'}
}
let cli = 'heroku'
if (global.config) {
  cli = global.config.bin
  let pjson = global.config.pjson['cli-engine']
  if (pjson['help'] && pjson['help']['plugins']) {
    examplePlugins = pjson['help']['plugins']
  }
}
const examplePluginsHelp = Object.entries(examplePlugins).map(([name, p]: [string, any]) => `    ${name} ${p.version}`)

export default class extends Command<*> {
  static topic = 'plugins'
  static flags = {core: flags.boolean({description: 'show core plugins'})}
  static description = 'list installed plugins'
  static help = `Example:
    $ ${cli} plugins
${examplePluginsHelp.join('\n')}
`

  async run () {
    let plugins = await new Plugins(this.config).list()
    plugins = plugins.filter(p => p.type !== 'builtin')
    plugins.sort(compare('name'))
    if (!this.flags.core) plugins = plugins.filter(p => p.type !== 'core')
    if (!plugins.length) this.out.warn('no plugins installed')
    for (let plugin of plugins) {
      let output = `${plugin.name} ${this.out.color.dim(plugin.version)}`
      if (plugin.type !== 'user') output += this.out.color.dim(` (${plugin.type})`)
      else if (plugin.tag !== 'latest') output += this.out.color.dim(` (${String(plugin.tag)})`)
      this.out.log(output)
    }
  }
}
