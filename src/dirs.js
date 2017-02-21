// @flow

import path from 'path'
import type {Plugin} from './plugins'

class Dirs {
  get os () { return require('os') }
  get home () { return this.os.homedir() }
  get windows (): boolean { return this.os.platform === 'win32' }
  get fs () { return require('fs-extra') }

  get data (): string {
    const config = require('./config')
    let d = path.join(this.home, '.local', 'share')
    if (this.windows) d = process.env.LOCALAPPDATA || d
    else d = process.env.XDG_DATA_HOME || d
    d = path.join(d, config.name)
    this.mkdirp(d)
    return d
  }

  get cache (): string {
    const config = require('./config')
    let d = path.join(this.home, '.cache')
    if (process.platform === 'darwin') d = path.join(this.home, 'Library', 'Caches', 'Yarn')
    if (this.windows) d = process.env.LOCALAPPDATA || d
    else d = process.env.XDG_DATA_HOME || d
    d = path.join(d, config.name)
    this.mkdirp(d)
    return d
  }

  get config (): string {
    const config = require('./config')
    let d = path.join(this.home, '.config')
    if (this.windows) d = process.env.LOCALAPPDATA || d
    else d = process.env.XDG_CONFIG_HOME || d
    d = path.join(d, config.name)
    this.mkdirp(d)
    return d
  }

  get autoupdatefile (): string { return path.join(this.cache, 'autoupdate') }
  get autoupdatelog (): string { return path.join(this.cache, 'autoupdate.log') }
  get updatelockfile (): string { return path.join(this.cache, 'update.lock') }
  get yarnBin (): string { return path.join(__dirname, '..', 'node_modules', '.bin', 'yarn') }
  get plugins (): string { return path.join(this.data, 'plugins') }
  get linkedPlugins (): string { return path.join(this.config, 'linked_plugins.json') }
  get errlog (): string { return path.join(this.cache, 'error.log') }
  get parentRoot (): string {
    const c = require('./config')
    return path.join(c.parent.filename, '..', '..')
  }
  get reexecBin (): string {
    const config = require('./config')
    return path.join(this.parentRoot, 'bin', config.bin)
  }
  userPlugin (plugin: Plugin) { return path.join(this.plugins, 'node_modules', plugin) }

  exists (dir: string) {
    return this.fs.existsSync(dir)
  }

  mkdirp (dir: string) {
    if (this.exists(dir)) return
    this.fs.mkdirpSync(dir)
  }
}

module.exports = new Dirs()
