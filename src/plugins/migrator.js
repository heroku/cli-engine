// @flow

import {type Config} from 'cli-engine-config'
import Output from 'cli-engine-command/lib/output'
import Plugins from '.'
import UserPlugins from './user'
import path from 'path'
import fs from 'fs-extra'

const debug = require('debug')('cli-engine:migrator')

export default class {
  plugins: Plugins
  userPlugins: UserPlugins
  config: Config
  out: Output

  constructor (plugins: Plugins, config: Config) {
    this.plugins = plugins
    this.config = config
    this.userPlugins = plugins.user
    this.out = plugins.out
  }

  async run () {
    if (fs.existsSync(this.userPlugins.userPluginsPJSONPath)) return
    if (!fs.existsSync(path.join(this.userPlugins.userPluginsDir, 'plugins.json'))) return
    let pljson = await this._readPluginsJSON()
    if (!pljson) return false
    debug('has existing plugins')
    this.out.action.start('Migrating Heroku CLI v5 plugins')
    debug('removing existing node_modules')
    await this.rimraf(path.join(this.userPlugins.userPluginsDir, 'node_modules'))
    for (let p of pljson) {
      if (this.plugins.isPluginInstalled(p.name)) {
        debug(`Skipping already installed plugin: ${p.name}`)
      } else {
        debug(`installing ${p.name}`)
        await this._installPlugin(p.name, p.tag)
      }
    }
    await this.userPlugins.yarn.exec(['install', '--force'])
    this.plugins.loaded = false
    await this.plugins.load()
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
        await this.plugins.install(name)
      }
    } catch (err) {
      this.out.warn(err)
    }
  }

  async _reinstallViaSymlink (name: string) {
    debug(`Installing via symlink: ${name}`)
    let pluginPath = fs.realpathSync(this.userPlugins.userPluginPath(name))
    await this.plugins.addLinkedPlugin(pluginPath)
  }

  async rimraf (d: string) {
    debug(`rimraf ${d}`)
    return new Promise((resolve, reject) => {
      require('rimraf')(d, err => err ? reject(err) : resolve())
    })
  }
}
