// @flow

import Command, {flags} from 'cli-engine-command'
import Updater from '../updater'
import PluginsUpdate from './plugins/update'
import Analytics from '../analytics'
import Plugins from '../plugins'
import fs from 'fs-extra'
import path from 'path'
import vars from 'cli-engine-heroku/lib/vars'

export default class Update extends Command {
  static topic = 'update'
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
    await this.updater.fetchVersion(this.config.channel, true)
    let analytics = new Analytics({out: this.out, config: this.config})
    await analytics.submit()
    await PluginsUpdate.run({config: this.config, output: this.out})
    await this.logChop()
    await this.generateAutocompleteCommands()
    await this.generateAutocompleteApps()
  }

  async logChop () {
    try {
      const logChopper = require('log-chopper').default
      await logChopper.chop(this.out.errlog)
    } catch (e) { this.out.debug(e.message) }
  }

  async generateAutocompleteCommands () {
    if (this.config.windows) return
    const flatten = require('lodash.flatten')
    try {
      // TODO: move from cli to client dir if not already present
      // if (!fs.pathExistsSync(path.join(this.config.dataDir, 'client', 'autocomplete', 'bash', 'heroku'))) {
      //   const cli = path.join(this.config.dataDir, 'cli', 'autocomplete')
      //   const client = path.join(this.config.dataDir, 'client', 'autocomplete')
      //   fs.copySync(cli, client)
      // }
      const plugins = await new Plugins(this.out).list()
      const cmds = plugins.map(p => p.commands.filter(c => !c.hidden).map(c => {
        let publicFlags = Object.keys(c.flags).filter(flag => !c.flags[flag].hidden).map(flag => `--${flag}`).join(' ')
        let flags = publicFlags.length ? ` ${publicFlags}` : ''
        let namespace = p.namespace ? `${p.namespace}:` : ''
        return `${namespace}${c.id}${flags}`
      }))
      const commands = flatten(cmds).join('\n')
      fs.writeFileSync(path.join(this.config.dataDir, 'client', 'node_modules', 'cli-engine', 'autocomplete', 'commands'), commands)
    } catch (e) {
      this.out.debug('Error creating autocomplete commands')
      this.out.debug(e.message)
    }
  }

  async generateAutocompleteApps () {
    if (this.config.windows) return
    const Netrc = require('netrc-parser')
    let netrc = new Netrc()
    try {
      const token = netrc.machines[vars.apiHost].password || ''
      const apps = await this.http.get('https://api.heroku.com/users/~/apps', { headers: {
        'Authorization': `Bearer ${token}`,
        'accept': 'application/vnd.heroku+json; version=3',
        'content-type': 'application/json'}
      })
      const appNames = apps.map(a => a.name).join('\n')
      fs.writeFileSync(path.join(this.config.dataDir, 'client', 'node_modules', 'cli-engine', 'autocomplete', 'apps'), appNames)
    } catch (e) {
      this.out.debug('Error creating autocomplete apps')
      this.out.debug(e.message)
    }
  }
}
