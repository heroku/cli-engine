// @flow

import type Config from 'cli-engine-command/lib/config'
import type Output from 'cli-engine-command/lib/output'
import path from 'path'
import Plugins from './plugins'
import Plugin from './plugin'
import PluginsList from './plugins_list'
import Yarn from './yarn'
import klaw from 'klaw-sync'
import fs from 'fs-extra'

type PJSON = {
  name: string,
  main?: string,
  scripts?: {
    prepare?: string
  }
}

class LinkedPlugin extends Plugin {

}

export default class LinkedPlugins extends PluginsList {
  constructor (plugins: Plugins) {
    super()
    this.yarn = plugins.yarn
    this.plugins = plugins
    this.config = plugins.config
    this.out = plugins.out
    try {
      this._data = fs.readJSONSync(this.file)
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
      this._data = {
        version: '1',
        plugins: []
      }
    }
    this._list = this._data.plugins.map(p => this.plugin(p))
  }

  yarn: Yarn
  plugins: Plugins
  config: Config
  out: Output
  _list: Plugin[]
  _data: {
    version: string,
    plugins: string[]
  }

  /**
   * adds a linked plugin
   * @param {string} p - path of plugin
   */
  async add (p: string) {
    if (!this.config.debug) this.out.action.start(`Running prepare script for ${p}`)
    // flow$ignore
    let pjson: PJSON = require(path.join(p, 'package.json'))
    await this.prepare(p)
    const name = pjson.name
    if (this.plugins.plugins.find(p => p.type === 'user' && p.name === name)) {
      throw new Error(`${name} is already installed.
Uninstall with ${this.out.color.cmd(this.config.bin + ' plugins:uninstall ' + name)}`)
    }
    if (this._data.plugins.includes(p)) throw new Error(`${p} is already linked`)
    // flow$ignore
    let m = require(p)
    if (!m.commands) throw new Error(`${p} does not appear to be a CLI plugin`)
    this._data.plugins.push(p)
    this._save()
    this.out.action.stop()
    this.plugin(p)
  }

  /**
   * removes a linked plugin
   * @param {string} p - path of plugin
   */
  remove (p: string) {
    this._data.plugins = this._data.plugins.filter(q => q !== p)
    this._save()
  }

  /**
   * list linked plugins
   * @returns {Plugin[]}
   */
  list (): Plugin[] {
    return this._list
  }

  plugin (p: string): Plugin {
    return new Plugin('link', p, this.plugins)
  }

  /**
   * runs prepare() on all linked plugins
   */
  async refresh () {
    for (let plugin of this._data.plugins) {
      try {
        await this.prepare(plugin)
      } catch (err) {
        this.out.warn(`Error refreshing ${plugin}`)
        this.out.warn(err)
      }
    }
  }

  /**
   * installs plugin dependencies and runs npm prepare if needed
   */
  async prepare (p: string) {
    let pjson = this._pjson(p)
    await this._install(p)
    if (!pjson.main) throw new Error(`No main script specified in ${path.join(p, 'package.json')}`)
    let main = path.join(p, pjson.main)
    if (!this._needsPrepare(p, main)) return
    this.plugins.clearCache(pjson.name)
    if (!pjson.scripts || !pjson.scripts.prepare) return
    if (!this.config.debug) this.out.action.start(`Running prepare script for ${p}`)
    await this.yarn.exec(['run', 'prepare'], {cwd: p})
    fs.utimesSync(main, new Date(), new Date())
    this.out.action.stop()
  }

  _save () {
    fs.writeJSONSync(this.file, this._data)
  }

  _needsInstall (p: string): boolean {
    let modules = path.join(p, 'node_modules')
    if (!fs.existsSync(modules)) return true
    let modulesInfo = fs.statSync(modules)
    let pjsonInfo = fs.statSync(path.join(p, 'package.json'))
    return modulesInfo.mtime < pjsonInfo.mtime
  }

  _needsPrepare (p: string, main: string): boolean {
    if (!fs.existsSync(main)) return true
    let mainInfo = fs.statSync(main)
    let modulesInfo = fs.statSync(path.join(p, 'node_modules'))
    if (mainInfo.mtime < modulesInfo.mtime) return true
    return !!klaw(p, {nodir: true, ignore: '{node_modules,.git}'})
    .filter(f => f.path.endsWith('.js'))
    .find(f => f.stats.mtime > mainInfo.mtime)
  }

  async _install (p: string) {
    if (!this._needsInstall(p)) return
    if (!this.config.debug) this.out.action.start(`Installing dependencies for ${p}`)
    await this.yarn.exec([], {cwd: p})
    fs.utimesSync(path.join(p, 'node_modules'), new Date(), new Date())
    this.plugins.clearCache(this._pjson(p).name)
    this.out.action.stop()
  }

  // flow$ignore
  _pjson (p: string): PJSON { return require(path.join(p, 'package.json')) }

  get file (): string {
    return path.join(this.config.dirs.data, 'linked_plugins.json')
  }
}
