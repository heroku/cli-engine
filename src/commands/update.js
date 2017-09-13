// @flow

import Command, {flags} from 'cli-engine-command'
import {Updater} from '../updater'
import PluginsUpdate from './plugins/update'
import {Hooks} from '../hooks'

const debug = require('debug')('cli-engine:update')

function brew (...args) {
  const cp = require('child_process')
  debug('brew %o', args)
  return cp.spawnSync('brew', args, {stdio: 'inherit'})
}

export default class Update extends Command<*> {
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
    this.updater = new Updater(this.config)
    if (this.config.updateDisabled === 'Update CLI with `brew upgrade heroku`') {
      this.migrateBrew()
    } else if (this.config.updateDisabled) {
      this.out.warn(this.config.updateDisabled)
    } else {
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
    await this.updater.fetchVersion(true)
    debug('plugins update')
    await PluginsUpdate.run({...this.config, argv: []})
    debug('log chop')
    await this.logChop()
    debug('autocomplete')
    const hooks = new Hooks({config: this.config})
    await hooks.run('update')
    debug('done')
  }

  async logChop () {
    try {
      const logChopper = require('log-chopper').default
      await logChopper.chop(this.config.errlog)
    } catch (e) { debug(e.message) }
  }

  migrateBrew () {
    try {
      debug('migrating from brew')
      const fs = require('fs-extra')
      let p = fs.realpathSync('/usr/local/bin/heroku')
      if (p.match(/\/usr\/local\/Cellar\/heroku\/\d+\.\d+\.\d+\//)) {
        // not on private tap, move to it
        this.out.action.start('Upgrading homebrew formula')
        brew('tap', 'heroku/brew')
        brew('upgrade', 'heroku/brew/heroku')
        this.out.action.stop()
      }
    } catch (err) {
      debug(err)
    }
  }
}
