// @flow

import Command, {flags} from 'cli-engine-command'
import Updater from '../updater'
import PluginsUpdate from './plugins/update'
import Analytics from '../analytics'
import fs from 'fs-extra'

export default class Update extends Command {
  static topic = 'update'
  static args = [
    {name: 'channel', optional: true}
  ]
  updater: Updater
  autoupdatelogfile: String

  async run () {
    this.updater = new Updater(this.out)
    this.autoupdatelogfile = fs.openSync(this.config.autoupdatelogfile, 'a')
    if (this.config.updateDisabled) {
      this.out.warn(this.config.updateDisabled)
      this.out.logAutocomplete(this.config.updateDisabled)
    }
    else {
      this.out.action.start(`${this.config.name}: Updating CLI`)
      this.out.logAutocomplete(`${this.config.name}: Updating CLI`)
      let channel = this.argv[0] || this.config.channel
      let manifest = await this.updater.fetchManifest(channel)
      if (this.config.version === manifest.version && channel === this.config.channel) {
        this.out.action.stop(`already on latest version: ${this.config.version}`)
        this.out.logAutocomplete(`already on latest version: ${this.config.version}`)
      } else {
        let {yellow, green} = this.out.color
        this.out.action.start(`${this.config.name}: Updating CLI from ${green(this.config.version)} to ${green(manifest.version)}${channel === 'stable' ? '' : ' (' + yellow(channel) + ')'}`)
        this.out.logAutocomplete(`${this.config.name}: Updating CLI from ${this.config.version} to ${manifest.version}${channel === 'stable' ? '' : ' (' + channel + ')'}`)
        await this.updater.update(manifest)
        this.out.action.stop()
        try {
          await this.updater.autoupdate(true)
          this.out.exit(0)
        } catch (err) {
          this.out.warn(err, 'post-install autoupdate failed')
          this.out.logAutocomplete(err, 'post-install autoupdate failed')
        }
      }
    }
    await this.updater.fetchVersion(this.config.channel, true)
    let analytics = new Analytics({out: this.out, config: this.config})
    await analytics.submit()
    await PluginsUpdate.run({config: this.config})
    await this.logChop()
  }

  async logChop () {
    try {
      const logChopper = require('log-chopper').default
      await logChopper.chop(this.out.errlog)
    } catch (e) { this.out.debug(e.message) }
  }
}
