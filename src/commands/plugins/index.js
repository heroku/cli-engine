// @flow

import Command, {flags} from 'cli-engine-command'
import {compare} from '../../util'
import Plugins from '../../plugins'

export default class extends Command<*> {
  static topic = 'plugins'
  static flags = {core: flags.boolean({description: 'show core plugins'})}
  static description = 'list installed plugins'
  static help = `Example:
    $ heroku plugins
    heroku-ci 1.8.0
    heroku-cli-status 3.0.10 (link)
    heroku-fork 4.1.22
`

  async run () {
    let plugins = await new Plugins(this.out).list()
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
