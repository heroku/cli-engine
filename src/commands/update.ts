import { flags } from '@cli-engine/command'
import { color } from '@heroku-cli/color'
import cli from 'cli-ux'
import * as path from 'path'

import deps from '../deps'
import { Hooks } from '../hooks'
import { Updater } from '../updater'
import { wait } from '../util'

import Command from './base'
import PluginsUpdate from './plugins/update'

const debug = require('debug')('cli:update')

const g = global as any
const cliBin = g.config ? g.config.bin : 'heroku'

export default class Update extends Command {
  static topic = 'update'
  static description = `update the ${cliBin} CLI`
  static args = [{ name: 'channel', optional: true }]
  static flags: flags.Input = {
    autoupdate: flags.boolean({ hidden: true }),
  }
  updater: Updater

  async run() {
    this.updater = new Updater(this.config)
    if (this.flags.autoupdate) {
      let waiting = true
      while (waiting) {
        wait(3600000)
        let fd = await deps.file.open(this.updater.autoupdatelogfile, 'a')
        deps.file.write(fd, 'Waited one hour...')
        const m = await this.mtime(this.updater.lastrunfile)
        const waitedLongEnough = m.isBefore(deps.moment().subtract(1, 'hours'))
        if (waitedLongEnough) waiting = false
      }
    } else {
      // on manual run, also log to file
      cli.config.errlog = path.join(this.config.cacheDir, 'autoupdate')
    }

    if (this.config.updateDisabled) {
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
      }
    }
    debug('fetch version')
    await this.updater.fetchVersion(true)
    debug('plugins update')
    await PluginsUpdate.run([], this.config)
    debug('log chop')
    await this.logChop()
    debug('tidy')
    await this.updater.tidy()
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

  private async mtime(f: string) {
    const { mtime } = await deps.file.stat(f)
    return deps.moment(mtime)
  }
}
