// @flow

import Command from 'cli-engine-command'
import path from 'path'
import Plugins from '../plugins'

export default class PluginsLink extends Command {
  static topic = 'plugins'
  static command = 'link'
  static args = [
    {name: 'path', optional: true}
  ]

  async run () {
    const plugins = new Plugins(this.config)
    const m = path.resolve(this.args.path || process.cwd())
    this.action.start(`Linking plugin from ${m}`)
    // flow$ignore
    if (!require(m).commands) throw new Error('this does not appear to be a Heroku plugin')
    plugins.addLinkedPlugin(m)
  }
}
