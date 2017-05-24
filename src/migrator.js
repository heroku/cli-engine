// @flow

import {type Config} from 'cli-engine-config'
import Output from 'cli-engine-command/lib/output'
import Plugins from './plugins'
import UserPlugins from './plugins/user'
import path from 'path'
import fs from 'fs-extra'

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

  async run () : Promise<boolean> {
    if (fs.existsSync(this.userPlugins.userPluginsPJSONPath)) return false
    if (!fs.existsSync(path.join(this.userPlugins.userPluginsDir, 'plugins.json'))) return false
    let pljson = await this._readPluginsJSON()
    if (!pljson) return false
    this.out.debug('Migrating V5 plugins...')
    for (let p of pljson) {
      if (this.plugins.isPluginInstalled(p.name)) {
        this.out.debug(`Skipping already installed plugin: ${p.name}`)
      } else {
        await this._installPlugin(p.name, p.tag)
      }
    }
    return true
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
        await this._addToPJSON(name, tag)
      }
    } catch (err) {
      this.out.warn(err)
    }
  }

  async _reinstallViaSymlink (name: string) {
    this.out.debug(`Installing via symlink: ${name}`)
    let pluginPath = fs.realpathSync(this.userPlugins.userPluginPath(name))
    await this.plugins.addLinkedPlugin(pluginPath)
  }

  async _addToPJSON (name: string, tag: string) {
    this.out.debug(`Adding to plugins pjson: ${name}`)
    this.plugins.addPackageToPJSON(name, tag)
  }
}
