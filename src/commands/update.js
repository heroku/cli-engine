// @flow

import Command from 'cli-engine-command'
import Updater from '../updater'

export default class Update extends Command {
  static topic = 'update'
  static args = [
    {name: 'channel', optional: true}
  ]

  async run () {
    let updater = new Updater(this.config)
    if (this.config.updateDisabled) this.warn(this.config.updateDisabled)
    else {
      this.action.start(`${this.config.name}: Updating CLI`)
      let channel = this.args.channel || this.config.channel
      let manifest = await updater.fetchManifest(channel)
      if (this.config.version === manifest.version && channel === this.config.channel) {
        this.action.stop(`already on latest version: ${this.config.version}`)
      } else {
        this.action.start(`${this.config.name}: Updating CLI to ${this.color.green(manifest.version)}${channel === 'stable' ? '' : ' (' + this.color.yellow(channel) + ')'}`)
        await updater.update(manifest)
        this.action.stop()
      }
    }
    this.action.start(`${this.config.name}: Updating plugins`)
  }
}
