// @flow

import {type Flag, type Arg} from 'cli-engine-command'
import {type Config} from 'cli-engine-config'
import type Output from 'cli-engine-command/lib/output'
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
      if (err.code !== 'ENOENT') throw err
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

  deletePlugin (...names: string[]) {
    for (let k of Object.keys(this.cache.plugins)) {
      if (names.includes(this.cache.plugins[k].name)) {
        this.out.debug(`Clearing cache for ${k}`)
        this.constructor.updated = true
        delete this.cache.plugins[k]
      }
    }
    this.save()
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
