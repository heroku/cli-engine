// @flow

import {Config, Base} from 'cli-engine-command'
import path from 'path'
import Plugins, {Plugin} from './plugins'
import Yarn from './yarn'
import klaw from 'klaw-sync'

type PJSON = {
  name: string,
  main?: string,
  scripts?: {
    prepare?: string
  }
}

export default class LinkedPlugins extends Base {
  constructor (config: Config, plugins: Plugins) {
    super(config)
    this.yarn = new Yarn(config)
    this.plugins = plugins
    try {
      this._data = this.fs.readJSONSync(this.file)
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
      this._data = {
        version: '1',
        plugins: []
      }
    }
  }

  yarn: Yarn
  plugins: Plugins
  config: Config
  _data: {
    version: string,
    plugins: string[]
  }

  async add (p: string) {
    if (!this.config.debug) this.action.start(`Running prepare script for ${p}`)
    // flow$ignore
    let pjson: PJSON = require(path.join(p, 'package.json'))
    await this.prepare(p)
    // flow$ignore
    let m = require(p)
    if (!m.commands) throw new Error(`${p} does not appear to be a CLI plugin`)
    const name = pjson.name
    if (this.plugins.plugins.find(p => p.type === 'user' && p.name === name)) {
      throw new Error(`${name} is already installed.
Uninstall with ${this.color.cmd(this.config.bin + ' plugins:uninstall ' + name)}`)
    }
    if (this._data.plugins.includes(p)) throw new Error(`${p} is already linked`)
    this._data.plugins.push(p)
    this._save()
    this.action.stop()
  }

  remove (p: string) {
    this._data.plugins = this._data.plugins.filter(q => q !== p)
    this._save()
  }

  list (): Plugin[] {
    return this._data.plugins.map(p => new Plugin('link', p, this.config, this.plugins.cache))
  }

  async refresh () {
    for (let plugin of this._data.plugins) {
      try {
        await this.prepare(plugin)
      } catch (err) {
        this.warn(`Error refreshing ${plugin}`)
        this.warn(err)
      }
    }
  }

  async prepare (p: string) {
    await this._install(p)
    // flow$ignore
    let pjson: PJSON = require(path.join(p, 'package.json'))
    if (!pjson.main) throw new Error(`No main script specified in ${path.join(p, 'package.json')}`)
    if (!pjson.scripts || !pjson.scripts.prepare) return
    let main = path.join(p, pjson.main)
    if (!this._needsPrepare(p, main)) return
    if (!this.config.debug) this.action.start(`Running prepare script for ${p}`)
    this.yarn.options.cwd = p
    await this.yarn.exec('run', 'prepare')
    this.fs.utimesSync(main, new Date(), new Date())
    this.action.stop()
  }

  _save () {
    this.fs.writeJSONSync(this.file, this._data)
  }

  _needsInstall (p: string): boolean {
    let modules = path.join(p, 'node_modules')
    if (!this.fs.existsSync(modules)) return true
    let modulesInfo = this.fs.statSync(modules)
    let pjsonInfo = this.fs.statSync(path.join(p, 'package.json'))
    return modulesInfo.mtime < pjsonInfo.mtime
  }

  _needsPrepare (p: string, main: string): boolean {
    if (!this.fs.existsSync(main)) return true
    let mainInfo = this.fs.statSync(main)
    let modulesInfo = this.fs.statSync(path.join(p, 'node_modules'))
    if (mainInfo.mtime < modulesInfo.mtime) return true
    return !!klaw(p, {nodir: true, ignore: '{node_modules,.git}'})
    .filter(f => f.path.endsWith('.js'))
    .find(f => f.stats.mtime > mainInfo.mtime)
  }

  async _install (p: string) {
    if (!this._needsInstall(p)) return
    if (!this.config.debug) this.action.start(`Installing dependencies for ${p}`)
    this.yarn.options.cwd = p
    await this.yarn.exec()
    this.fs.utimesSync(path.join(p, 'node_modules'), new Date(), new Date())
    this.action.stop()
  }

  get file (): string { return path.join(this.config.dirs.data, 'linked_plugins.json') }
}
