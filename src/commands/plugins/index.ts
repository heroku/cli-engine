import {Command, flags} from 'cli-engine-command'
import {Plugins} from '../../plugins'
import _ from 'ts-lodash'

export default class extends Command {
  options = {
    flags: {core: flags.boolean({description: 'show core plugins'})},
    description: 'list installed plugins',
    help: `Example:
    $ heroku plugins
    heroku-ci 1.8.0
    heroku-cli-status 3.0.10 (link)
    heroku-fork 4.1.22
`
  }

  async run () {
    let plugins = await new Plugins({config: this.config}).listPlugins()
    _.sortBy(plugins, 'name')
    if (!this.flags.core) plugins = plugins.filter(p => p.type !== 'core')
    if (!plugins.length) this.cli.warn('no plugins installed')
    for (let plugin of plugins) {
      let output = `${plugin.name} ${this.color.dim(plugin.version)}`
      if (plugin.type !== 'user') output += this.color.dim(` (${plugin.type})`)
      else if (plugin.tag !== 'latest') output += this.color.dim(` (${String(plugin.tag)})`)
      this.cli.log(output)
    }
  }
}
