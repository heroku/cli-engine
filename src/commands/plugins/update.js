// @flow

import Command from 'cli-engine-command'
import Plugins from '../../plugins'

export default class PluginsUpdate extends Command {
  static topic = 'plugins'
  static command = 'update'

  plugins = new Plugins(this)

  async run () {
    this.action.start(`${this.config.name}: Updating plugins`)
    this.plugins.pluginsUpdate()
  }
}
