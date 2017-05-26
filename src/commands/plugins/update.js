// @flow

import Command from 'cli-engine-command'
import Plugins from '../../plugins'

export default class PluginsUpdate extends Command {
  static topic = 'plugins'
  static command = 'update'

  plugins: Plugins

  async run () {
    this.plugins = await (new Plugins(this.out)).init()
    this.out.action.start(`${this.config.name}: Updating plugins`)
    await this.plugins.update()
  }
}
