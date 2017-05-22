// @flow

import {type Flag, type Arg} from 'cli-engine-command'
import {type Config} from 'cli-engine-config'
import type Output from 'cli-engine-command/lib/output'
import Plugin from './plugin'
import {Manager, type PluginPath} from './manager'
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
  node_version?: ?string,
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

  initialize () {
    this._cache = {
      version: this.config.version,
      plugins: {},
      node_version: null
    }
  }

  clear () {
    this._cache = {
      version: this.config.version,
      plugins: {},
      node_version: this._cache.node_version
    }
  }

  get file (): string { return path.join(this.config.cacheDir, 'plugins.json') }
  get cache (): CacheData {
    if (this._cache) return this._cache

    try {
      this._cache = fs.readJSONSync(this.file)
    } catch (err) {
      if (err.code !== 'ENOENT') this.out.debug(err)
      this.initialize()
    }
    if (this._cache.version !== this.config.version) {
      this.clear()
    }
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
      this.out.warn(err)
      return {
        name: pluginPath.path,
        path: pluginPath.path,
        version: '',
        commands: [],
        topics: []
      }
    }
  }

  async fetchManagers (...managers: Manager[]) : Promise<Plugin[]> {
    let plugins = []
    if (this.cache.node_version !== process.version) {
      for (let manager of managers) {
        await manager.handleNodeVersionChange()
      }

      this.cache.node_version = process.version
      this.constructor.updated = true
    }

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
