import Command from '../base'

export default class PluginsUpdate extends Command {
  static topic = 'plugins'
  static command = 'update'
  static description = 'update installed plugins'

  async run() {
    await this.config.plugins.update()
  }
}
