const path = require('path')

const cache = Symbol('cache')
const config = Symbol('config')
const data = Symbol('data')

class Dirs {
  get os () { return require('os') }
  get home () { return this.os.homedir() }
  get windows () { return this.os.platform === 'win32' }
  get fs () { return require('fs-extra') }
  get data () {
    if (this[data]) return this[data]
    const config = require('./config')
    if (this.windows) this[data] = process.env.LOCALAPPDATA
    else this[data] = process.env.XDG_DATA_HOME || path.join(this.home, '.local', 'share')
    this[data] = path.join(this[data], config.name)
    this.mkdirp(this[data])
    return this[data]
  }

  get cache () {
    if (this[cache]) return this[cache]
    const config = require('./config')
    if (this.windows) this[cache] = process.env.LOCALAPPDATA
    else this[cache] = process.env.XDG_CACHE_HOME || path.join(this.home, '.cache')
    this[cache] = path.join(this[cache], config.name)
    this.mkdirp(this[cache])
    return this[cache]
  }

  get config () {
    if (this[config]) return this[config]
    const c = require('./config')
    if (this.windows) this[config] = process.env.LOCALAPPDATA
    else this[config] = process.env.XDG_CONFIG_HOME || path.join(this.home, '.config')
    this[config] = path.join(this[config], c.name)
    this.mkdirp(this[config])
    return this[config]
  }

  get autoupdatefile () { return path.join(this.cache, 'autoupdate') }
  get autoupdatelog () { return path.join(this.cache, 'autoupdate.log') }
  get updatelockfile () { return path.join(this.cache, 'update.lock') }
  get yarnBin () { return path.join(__dirname, '..', 'node_modules', '.bin', 'yarn') }
  get plugins () { return path.join(this.data, 'plugins') }
  get linkedPlugins () { return path.join(this.config, 'linked_plugins.json') }
  get errlog () { return path.join(this.cache, 'error.log') }
  get parentRoot () {
    const c = require('./config')
    return path.join(c.parent.filename, '..', '..')
  }
  get reexecBin () {
    const config = require('./config')
    return path.join(this.parentRoot, 'bin', config.bin)
  }
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
