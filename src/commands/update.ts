import { Command, flags, IBooleanFlag } from 'cli-engine-command'
import { Updater } from '../updater'
import PluginsUpdate from './plugins/update'
import { Hooks } from '../hooks'
import cli from 'cli-ux'
import * as path from 'path'
import { color } from 'heroku-cli-color'

const debug = require('debug')('cli:update')

function brew(...args: string[]) {
  const cp = require('child_process')
  debug('brew %o', args)
  return cp.spawnSync('brew', args, { stdio: 'inherit' })
}

const g = global as any
const cliBin = g.config ? g.config.bin : 'heroku'

export default class Update extends Command {
  static topic = 'update'
  static description = `update the ${cliBin} CLI`
  static args = [{ name: 'channel', optional: true }]
  static flags = {
    autoupdate: flags.boolean({ hidden: true }) as IBooleanFlag,
  }
  updater: Updater

  async run() {
    // on manual run, also log to file
    if (!this.flags.autoupdate) {
      cli.config.errlog = path.join(this.config.cacheDir, 'autoupdate')
    }
    this.updater = new Updater(this.config)
    if (this.config.updateDisabled === 'Update CLI with `brew upgrade heroku`') {
      this.migrateBrew()
    } else if (this.config.updateDisabled) {
      cli.warn(this.config.updateDisabled)
    } else {
      cli.action.start(`${this.config.name}: Updating CLI`)
      let channel = this.argv[0] || this.config.channel
      let manifest = await this.updater.fetchManifest(channel)
      if (this.config.version === manifest.version && channel === this.config.channel) {
        if (!process.env.CLI_ENGINE_HIDE_UPDATED_MESSAGE) {
          cli.action.stop(`already on latest version: ${this.config.version}`)
        }
      } else {
        cli.action.start(
          `${this.config.name}: Updating CLI from ${color.green(this.config.version)} to ${color.green(
            manifest.version,
          )}${channel === 'stable' ? '' : ' (' + color.yellow(channel) + ')'}`,
        )
        await this.updater.update(manifest)
        cli.action.stop()
        try {
          await this.updater.autoupdate(true)
          cli.exit(0)
        } catch (err) {
          cli.warn(err, { context: 'post-install autoupdate failed' })
        }
      }
    }
    debug('fetch version')
    await this.updater.fetchVersion(true)
    debug('plugins update')
    await PluginsUpdate.run({ ...this.config, argv: [] })
    debug('log chop')
    await this.logChop()
    debug('autocomplete')
    const hooks = new Hooks(this.config)
    await hooks.run('update')
    debug('done')
    cli.action.stop()
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
        cli.action.start('Upgrading homebrew formula')
        brew('tap', 'heroku/brew')
        brew('upgrade', 'heroku/brew/heroku')
        cli.action.stop()
      }
    } catch (err) {
      debug(err)
    }
  }
}
