// @flow

import Command from 'cli-engine-command'

export default class PluginsUpdate extends Command {
  static topic = 'plugins'
  static command = 'update'

  async run () {
    this.action.start(`${this.config.name}: Updating plugins`)
  }
}
