import { Command } from 'cli-engine-command'
import { Plugins } from '../../plugins'

export default class PluginsUpdate extends Command {
  static description = 'update installed plugins'

  async run() {
    let plugins = new Plugins({ config: this.config })
    await plugins.user.update()
  }
}
