// @flow

import {type Flag, type Arg} from 'cli-engine-command'
import {type Config} from 'cli-engine-config'
import type Output from 'cli-engine-command/lib/output'
import Plugin from './plugin'
import {IPluginManager, type PluginPath} from './plugin_manager'
import path from 'path'
import fs from 'fs-extra'

export type CachedCommand = {
  id: string,
  topic: string,
  command?: ?string,
  aliases?: string[],
  args: Arg[],
  flags: {[name: string]: Flag<*>},
  description: ?string,
  help?: ?string,
  usage?: ?string,
  hidden: boolean
}

export type CachedTopic = {
  topic: string,
  description?: ?string,
  hidden: boolean
}

export type CachedPlugin = {
  name: string,
  namespace?: ?string,
  path: string,
  version: string,
  commands: CachedCommand[],
  topics: CachedTopic[]
}

type CacheData = {
  version: string,
  plugins: {[path: string]: CachedPlugin}
}

export default class Cache {
  static updated = false
  config: Config
  out: Output
  _cache: CacheData

  constructor (output: Output) {
    this.out = output
    this.config = output.config
  }

  get file (): string { return path.join(this.config.cacheDir, 'plugins.json') }
  get cache (): CacheData {
    if (this._cache) return this._cache
    let initial = {version: this.config.version, plugins: {}}
    try {
      this._cache = fs.readJSONSync(this.file)
    } catch (err) {
      if (err.code !== 'ENOENT') this.out.debug(err)
      this._cache = initial
    }
    if (this._cache.version !== this.config.version) this._cache = initial
    return this._cache
  }

  plugin (path: string): ?CachedPlugin { return this.cache.plugins[path] }

  updatePlugin (path: string, plugin: CachedPlugin) {
    this.constructor.updated = true
    this.cache.plugins[path] = plugin
  }

  deletePlugin (...paths: string[]) {
    for (let path of paths) {
      this.out.debug(`Clearing cache for ${path}`)
      this.constructor.updated = true
      delete this.cache.plugins[path]
    }
    this.save()
  }

  fetch (pluginPath: PluginPath): CachedPlugin {
    let c = this.plugin(pluginPath.path)
    if (c) return c
    try {
      this.out.debug('updating cache for ' + pluginPath.path)
      let cachedPlugin = pluginPath.convertToCached()
      this.updatePlugin(pluginPath.path, cachedPlugin)
      return cachedPlugin
    } catch (err) {
      if (this.type === 'builtin') throw err

      // if we are updating we may cause the node version to bump requiring
      // binary packages to error here with a NODE_MODULE_VERSION error like
      // ▸    The module '/Users/rbriggs/.local/share/heroku/plugins/node_modules/snappy/build/Release/binding.node'
      // ▸    was compiled against a different Node.js version using
      // ▸    NODE_MODULE_VERSION 48. This version of Node.js requires
      // ▸    NODE_MODULE_VERSION 51. Please try re-compiling or re-installing
      // ▸    the module (for instance, using `npm rebuild` or`npm install`).

      // this will resolve itself in the plugins update so do not freak out
      // users with an error message here, but let it display for non-update
      // commands so that they know something is broken

      // this match is pretty hacky, but I do not think I can make this much
      // better since err just has a backtrace and message to match on
      if (err.message && err.message.includes('NODE_MODULE_VERSION') && process.argv[2] === 'update') {
        this.out.debug(err)
      } else {
        this.out.warn(err)
      }

      return {
        name: pluginPath.path,
        path: pluginPath.path,
        version: '',
        commands: [],
        topics: []
      }
    }
  }

  fetchManagers (...managers: IPluginManager[]) : Plugin[] {
    let plugins = []

    for (let manager of managers) {
      let paths = manager.list()
      plugins = plugins.concat(paths.map(function (pluginPath) : Plugin {
        return new Plugin(this.out, pluginPath, this.fetch(pluginPath))
      }, this))
    }

    this.save()

    return plugins
  }

  save () {
    if (!this.constructor.updated) return
    try {
      fs.writeJSONSync(this.file, this.cache)
    } catch (err) {
      this.out.warn(err)
    }
  }
}
