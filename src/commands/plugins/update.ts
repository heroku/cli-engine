import { Command } from 'cli-engine-command'
import { Plugins } from '../../plugins'

export default class PluginsUpdate extends Command {
  static topic = 'plugins'
  static command = 'update'
  static description = 'update installed plugins'

  plugins: Plugins

  async run() {
    this.plugins = new Plugins(this.config)
    await this.plugins.update()
  }
}
