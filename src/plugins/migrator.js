// @flow

import Output from 'cli-engine-command/lib/output'
import UserPlugins from './user'
import LinkedPlugins from './linked'
import PluginCache from './cache'
import path from 'path'
import fs from 'fs-extra'
import Lock from '../lock'

const debug = require('debug')('cli-engine:migrator')

export default class {
  userPlugins: UserPlugins
  linkedPlugins: LinkedPlugins
  out: Output
  lock: Lock

  constructor (out: Output) {
    let cache = new PluginCache(out)
    this.userPlugins = new UserPlugins({out, config: out.config, cache})
    this.linkedPlugins = new LinkedPlugins({out, config: out.config, cache})
    this.out = out
    this.lock = new Lock(this.out)
  }

  async run () {
    // short circuit quickly without having to aquire the writer lock
    if (fs.existsSync(this.userPlugins.userPluginsPJSONPath)) return
    if (!fs.existsSync(path.join(this.userPlugins.userPluginsDir, 'plugins.json'))) return

    let pljson = await this._readPluginsJSON()
    if (!pljson) return false

    let downgrade = await this.lock.upgrade()
    await this._run(pljson)
    await downgrade()
  }

  async _run (pljson: any) {
    // prevent two parallel migrations from happening in case of a race
    if (fs.existsSync(this.userPlugins.userPluginsPJSONPath)) return

    debug('has existing plugins')
    this.out.action.start('Migrating Heroku CLI v5 plugins')
    debug('removing existing node_modules')
    for (let p of pljson) {
      if (p.name === 'salesforcedx') continue
      debug(`installing ${p.name}`)
      await this._installPlugin(p.name, p.tag)
    }
    this.out.action.stop()
  }

  async _readPluginsJSON () {
    try {
      let pljsonPath = path.join(this.userPlugins.userPluginsDir, 'plugins.json')
      return fs.readJSONSync(pljsonPath)
    } catch (err) {
      this.out.debug(err.message)
    }
  }

  async _installPlugin (name: string, tag: string) {
    try {
      if (tag === 'symlink') {
        await this._reinstallViaSymlink(name)
      } else {
        if (tag === '') tag = 'latest'
        await this.userPlugins.install(name)
      }
    } catch (err) {
      this.out.warn(err)
    }
  }

  async _reinstallViaSymlink (name: string) {
    debug(`Installing via symlink: ${name}`)
    let pluginPath = fs.realpathSync(this.userPlugins.userPluginPath(name))
    await this.linkedPlugins.add(pluginPath)
  }
}
