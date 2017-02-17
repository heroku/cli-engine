const path = require('path')

class Dirs {
  get os () { return require('os') }
  get home () { return this.os.homedir() }
  get windows () { return this.os.platform === 'win32' }
  get fs () { return require('fs-extra') }
  get data () {
    if (this._data) return this._data
    const config = require('./config')
    if (this.windows) this._data = process.env.LOCALAPPDATA
    else this._data = process.env.XDG_DATA_HOME || path.join(this.home, '.local', 'share')
    this._data = path.join(this._data, config.name)
    this.mkdirp(this._data)
    return this._data
  }

  get cache () {
    if (this._cache) return this._cache
    const config = require('./config')
    if (this.windows) this._cache = process.env.LOCALAPPDATA
    else this._cache = process.env.XDG_CACHE_HOME || path.join(this.home, '.cache')
    this._cache = path.join(this._cache, config.name)
    this.mkdirp(this._cache)
    return this._cache
  }

  get config () {
    if (this._config) return this._config
    const config = require('./config')
    if (this.windows) this._config = process.env.LOCALAPPDATA
    else this._config = process.env.XDG_CONFIG_HOME || path.join(this.home, '.config')
    this._config = path.join(this._config, config.name)
    this.mkdirp(this._config)
    return this._config
  }

  get autoupdatefile () { return path.join(this.cache, 'autoupdate') }
  get updatelockfile () { return path.join(this.cache, 'update.lock') }
  get runningDir () { return path.join(__dirname, '..') }
  get yarnBin () { return path.join(__dirname, '..', 'node_modules', '.bin', 'yarn') }
  get plugins () { return path.join(this.data, 'plugins') }
  get linkedPlugins () { return path.join(this.config, 'linked_plugins.json') }
  userPlugin (plugin) { return path.join(exports.plugins, 'node_modules', plugin) }

  exists (dir) {
    return this.fs.existsSync(dir)
  }

  mkdirp (dir) {
    if (this.exists(dir)) return
    this.fs.mkdirpSync(dir)
  }
}

module.exports = new Dirs()
module.exports.cliRoot = path.join(__dirname, '..')
