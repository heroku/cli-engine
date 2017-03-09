// @flow

import Command from 'cli-engine-command'
import Plugins from '../../plugins'

export default class PluginsUpdate extends Command {
  static topic = 'plugins'
  static command = 'update'

  async run () {
    this.action.start(`${this.config.name}: Updating plugins`)
    let plugins = new Plugins(this.config)
    for (let plugin of plugins.linkedPlugins.list()) {
      this.warn(`Not updating linked plugin ${plugin.name}. Update manually with git.`)
    }
    for (let plugin of plugins.userPlugins) {
      this.action.start(`${this.config.name}: Updating plugin ${plugin.name}`)
      let version = await plugins.needsUpdate(plugin.name)
      if (!version) continue
      this.action.start(`${this.config.name}: Updating plugin ${plugin.name} to ${version}`)
      await plugins.update(plugin.name, version)
      this.action.stop()
    }
    this.action.start(`${this.config.name}: Updating plugins`)
  }
}
