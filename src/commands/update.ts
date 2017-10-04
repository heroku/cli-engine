import cli from 'cli-ux'
import { IBooleanFlag } from 'cli-flags'
import * as path from 'path'
import { Command, flags } from 'cli-engine-command'
import { Updater } from '../updater'
import PluginsUpdate from './plugins/update'
// import {Hooks} from '../hooks'

const debug = require('debug')('cli-engine:update')

function brew(...args: string[]) {
  const cp = require('child_process')
  debug('brew %o', args)
  return cp.spawnSync('brew', args, { stdio: 'inherit' })
}

const globalConfig = (<any>global).config
const cliBin = globalConfig ? globalConfig.bin : 'heroku'

export default class Update extends Command {
  options = {
    description: `update the ${cliBin} CLI`,
    args: [{ name: 'channel', optional: true }],
    flags: {
      autoupdate: flags.boolean({ hidden: true }) as IBooleanFlag,
    },
  }
  updater: Updater

  get autoupdatelog() {
    return path.join(this.config.cacheDir, 'autoupdate.log')
  }

  async run() {
    // on manual run, also log to file
    if (!this.flags.autoupdate) {
      cli.config.errlog = this.autoupdatelog
    }
    this.updater = new Updater(this.config)
    if (this.config.updateDisabled === 'Update CLI with `brew upgrade heroku`') {
      this.migrateBrew()
    } else if (this.config.updateDisabled) {
      this.cli.warn(this.config.updateDisabled)
    } else {
      this.cli.action.start(`${this.config.name}: Updating CLI`)
      let channel = this.argv[0] || this.config.channel
      let manifest = await this.updater.fetchManifest(channel)
      if (this.config.version === manifest.version && channel === this.config.channel) {
        this.cli.action.stop(`already on latest version: ${this.config.version}`)
      } else {
        let { yellow, green } = this.color
        this.cli.action.start(
          `${this.config.name}: Updating CLI from ${green(this.config.version)} to ${green(
            manifest.version,
          )}${channel === 'stable' ? '' : ' (' + yellow(channel) + ')'}`,
        )
        await this.updater.update(manifest)
        this.cli.action.stop()
        try {
          await this.updater.autoupdate(true)
          this.cli.exit(0)
        } catch (err) {
          this.cli.warn(err, { context: 'post-install autoupdate failed' })
        }
      }
    }
    debug('fetch version')
    await this.updater.fetchVersion(true)
    debug('plugins update')
    let pu = new PluginsUpdate(this.config)
    await pu._run([])
    debug('log chop')
    await this.logChop()
    debug('autocomplete')
    // const hooks = new Hooks({config: this.config})
    // await hooks.run('update')
    debug('done')
  }

  async logChop() {
    try {
      const logChopper = require('log-chopper').default
      await logChopper.chop(this.config.errlog)
    } catch (e) {
      debug(e.message)
    }
  }

  migrateBrew() {
    try {
      debug('migrating from brew')
      const fs = require('fs-extra')
      let p = fs.realpathSync('/usr/local/bin/heroku')
      if (p.match(/\/usr\/local\/Cellar\/heroku\/\d+\.\d+\.\d+\//)) {
        // not on private tap, move to it
        this.cli.action.start('Upgrading homebrew formula')
        brew('tap', 'heroku/brew')
        brew('upgrade', 'heroku/brew/heroku')
        this.cli.action.stop()
      }
    } catch (err) {
      debug(err)
    }
  }
}
