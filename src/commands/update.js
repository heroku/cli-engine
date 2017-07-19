// @flow

import Command, {flags} from 'cli-engine-command'
import Updater from '../updater'
import PluginsUpdate from './plugins/update'
import Analytics from '../analytics'
import AutocompleteScripter from '../autocomplete'

const debug = require('debug')('cli-engine:update')

export default class Update extends Command {
  static topic = 'update'
  static description = 'update the Heroku CLI'
  static args = [
    {name: 'channel', optional: true}
  ]
  static flags = {
    autoupdate: flags.boolean({hidden: true})
  }
  updater: Updater

  async run () {
    // on manual run, also log to file
    if (!this.flags.autoupdate) {
      this.out.stdout.logfile = this.out.autoupdatelog
      this.out.stderr.logfile = this.out.autoupdatelog
    }
    this.updater = new Updater(this.out)
    if (this.config.updateDisabled) this.out.warn(this.config.updateDisabled)
    else {
      this.out.action.start(`${this.config.name}: Updating CLI`)
      let channel = this.argv[0] || this.config.channel
      let manifest = await this.updater.fetchManifest(channel)
      if (this.config.version === manifest.version && channel === this.config.channel) {
        this.out.action.stop(`already on latest version: ${this.config.version}`)
      } else {
        let {yellow, green} = this.out.color
        this.out.action.start(`${this.config.name}: Updating CLI from ${green(this.config.version)} to ${green(manifest.version)}${channel === 'stable' ? '' : ' (' + yellow(channel) + ')'}`)
        await this.updater.update(manifest)
        this.out.action.stop()
        try {
          await this.updater.autoupdate(true)
          this.out.exit(0)
        } catch (err) {
          this.out.warn(err, 'post-install autoupdate failed')
        }
      }
    }
    debug('fetch version')
    await this.updater.fetchVersion(this.config.channel, true)
    debug('analytics')
    let analytics = new Analytics({out: this.out, config: this.config})
    await analytics.submit()
    debug('plugins update')
    await PluginsUpdate.run({config: this.config, output: this.out})
    debug('log chop')
    await this.logChop()
    debug('autocomplete')
    if (this.config.windows) {
      debug('skipping autocomplete on windows')
    } else {
      let ac = new AutocompleteScripter(this)
      await ac.generateCommandsCache()
      await ac.generateCommandFuncs()
    }
    debug('done')
  }

  async logChop () {
    try {
      const logChopper = require('log-chopper').default
      await logChopper.chop(this.out.errlog)
    } catch (e) { this.out.debug(e.message) }
  }
}
