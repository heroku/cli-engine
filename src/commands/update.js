// @flow

import Command from 'cli-engine-command'
import Updater from '../updater'
import PluginsUpdate from './plugins/update'
import Analytics from '../analytics'
import Plugins from '../plugins'

export default class Update extends Command {
  static topic = 'update'
  static args = [
    {name: 'channel', optional: true}
  ]
  updater: Updater

  async run () {
    this.updater = new Updater(this.out)
    if (this.config.updateDisabled) this.out.warn(this.config.updateDisabled)
    else {
      this.out.action.start(`${this.config.name}: Updating CLI`)
      let channel = this.argv[0] || this.config.channel
      let manifest = await this.updater.fetchManifest(channel)
      if (this.config.version === manifest.version && channel === this.config.channel) {
        this.out.action.stop(`already on latest version: ${this.config.version}`)
      } else {
        this.out.action.start(`${this.config.name}: Updating CLI to ${this.out.color.green(manifest.version)}${channel === 'stable' ? '' : ' (' + this.out.color.yellow(channel) + ')'}`)
        await this.updater.update(manifest)
        this.out.action.stop()
      }
    }
    let plugins = await (new Plugins(this.out).init())
    let analytics = new Analytics({
      out: this.out,
      config: this.config,
      plugins: plugins
    })
    await analytics.submit()
    await PluginsUpdate.run({config: this.config})
  }
}
