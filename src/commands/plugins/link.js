// @flow

import Command from 'cli-engine-command'
import Plugins from '../../plugins'
import path from 'path'

export default class PluginsLink extends Command {
  static topic = 'plugins'
  static command = 'link'
  static args = [
    {name: 'path', optional: true, description: 'local file path to plugin root'}
  ]
  static description = 'links a local plugin to the CLI for development'
  static help = `Example:
    $ heroku plugins:link .
    Installing dependencies for /Users/dickeyxxx/src/github.com/heroku/heroku-status... done
    Running prepare script for /Users/dickeyxxx/src/github.com/heroku/heroku-status... done`

  plugins: Plugins

  async run () {
    this.plugins = new Plugins({output: this.out})
    let p = path.resolve(this.argv[0] || process.cwd())
    this.out.action.start(`Linking ${p}`)
    await this.plugins.addLinkedPlugin(p)
  }
}
