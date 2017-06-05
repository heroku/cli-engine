// @flow

import Command from 'cli-engine-command'
import Updater from '../updater'
import PluginsUpdate from './plugins/update'
import Analytics from '../analytics'
import Plugins from '../plugins'
import fs from 'fs-extra'
import path from 'path'
import flatten from 'lodash.flatten'

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
    await this.updater.fetchVersion(this.config.channel, true)
    let analytics = new Analytics({out: this.out, config: this.config})
    await analytics.submit()
    await PluginsUpdate.run({config: this.config})
    await this.logChop()
    await this.generateAutocompleteCommands()
  }

  async logChop () {
    try {
      const logChopper = require('log-chopper').default
      await logChopper.chop(this.out.errlog)
    } catch (e) { this.out.debug(e.message) }
  }

  async generateAutocompleteCommands () {
    try {
      // move from cli to client dir if not already present
      if (!fs.pathExistsSync(path.join(this.config.dataDir, 'client', 'autocomplete', 'bash', 'heroku'))) {
        const cli = path.join(this.config.dataDir, 'cli', 'autocomplete')
        const client = path.join(this.config.dataDir, 'client', 'autocomplete')
        fs.copySync(cli, client)
      }
      const plugins = await new Plugins(this.out).list()
      const cmds = plugins.map(p => p.cachedPlugin.commands.map(c => {
        if (c.hidden) return
        let plublicFlags = Object.keys(c.flags).filter(flag => !c.flags[flag].hidden).map(flag => `--${flag}`).join(' ')
        let flags = plublicFlags.length ? ` ${plublicFlags}` : ''
        // to-do: add namespace in after namespace refactor
        return `${c.id}${flags}`
      }))
      const commands = flatten(cmds).filter(c => !!c).join('\n')
      fs.writeFileSync(path.join(this.config.dataDir, 'client', 'autocomplete', 'commands'), commands)
    } catch (e) {
      this.out.debug('Error creating autocomplete commands')
      this.out.debug(e.message)
    }
  }
}
