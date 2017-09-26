// @flow

import type {Config} from 'cli-engine-config'
import UserPlugins from './user'
import LinkedPlugins from './linked'
import PluginCache from './cache'
import path from 'path'
import fs from 'fs-extra'
import Lock from '../lock'
import {CLI} from 'cli-ux'

const debug = require('debug')('cli-engine:migrator')

const SALESFORCE_BUILTINS = [
  'salesforcedx',
  'salesforce-alm',
  'force-language-services',
  'salesforce-lightning-cli'
]

export default class {
  config: Config
  userPlugins: UserPlugins
  linkedPlugins: LinkedPlugins
  cli: CLI
  lock: Lock

  constructor (config: Config) {
    this.config = config
    let cache = new PluginCache(config)
    this.userPlugins = new UserPlugins({config, cache})
    this.linkedPlugins = new LinkedPlugins({config, cache})
    this.cli = new CLI({mock: config.mock})
    this.lock = new Lock(config)
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
    this.cli.action.start(`Migrating ${this.config.bin} CLI v5 plugins`)
    debug('removing existing node_modules')
    for (let p of pljson) {
      if (SALESFORCE_BUILTINS.includes(p.name)) continue
      debug(`installing ${p.name}`)
      await this._installPlugin(p.name, p.tag)
    }
    this.cli.action.stop()
  }

  async _readPluginsJSON () {
    try {
      let pljsonPath = path.join(this.userPlugins.userPluginsDir, 'plugins.json')
      return fs.readJSONSync(pljsonPath)
    } catch (err) {
      debug(err.message)
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
      this.cli.warn(err)
    }
  }

  async _reinstallViaSymlink (name: string) {
    debug(`Installing via symlink: ${name}`)
    let pluginPath = fs.realpathSync(this.userPlugins.userPluginPath(name))
    await this.linkedPlugins.add(pluginPath)
  }
}
