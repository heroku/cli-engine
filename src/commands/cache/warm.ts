import { Plugins } from '../../plugins'
import { Command } from 'cli-engine-command'

export default class CacheWarm extends Command {
  static topic = 'cache'
  static command = 'warm'
  static hidden = true
  static description = 'warm the caches'
  static args = [{ name: 'channel', optional: true }]
  plugins: Plugins

  async run() {
    this.plugins = new Plugins({ config: this.config })
    await this.plugins.warmCache()
  }
}
