import deps from '../deps'
import { Config } from 'cli-engine-config'
import * as fs from 'fs-extra'
import * as path from 'path'
import { Plugin } from './plugin'

const debug = require('debug')('cli:plugins:cache')

function cacheKey(plugin: Plugin) {
  return [plugin.name, plugin.type, plugin.version].join(':')
}

export type CachePlugin = {
  [k: string]: any
  name: string
  type: string
}

export type CacheJSON = {
  version: string
  plugins: { [k: string]: CachePlugin }
}

export class PluginCache {
  constructor(protected config: Config) {}

  public needsSave: boolean = false
  private cache: CacheJSON

  public async init() {
    if (this.cache) return
    debug('init')
    this.cache = (await this.read()) || {
      version: this.config.userAgent,
      plugins: {},
    }
    if (!this.cache.plugins) this.cache.plugins = {}
  }

  public async save(): Promise<void> {
    if (!this.needsSave) return
    await deps.file.outputJSON(this.file, this.cache, { spaces: 2 })
    this.needsSave = false
  }

  public async fetch<T>(plugin: Plugin, prop: string, fn: () => Promise<T>): Promise<T> {
    let pluginCache = this.cache.plugins[cacheKey(plugin)]
    if (!pluginCache) {
      pluginCache = this.cache.plugins[cacheKey(plugin)] = {} as CachePlugin
    }
    if (!pluginCache[prop]) {
      pluginCache[prop] = await fn()
      this.needsSave = true
    }
    return pluginCache[prop]
  }

  private get file() {
    return path.join(this.config.cacheDir, 'commands.json')
  }

  private async read(): Promise<CacheJSON | undefined> {
    try {
      let cache = await fs.readJSON(this.file)
      if (cache.version !== this.config.userAgent) return
      return cache
    } catch (err) {
      if (err.code === 'ENOENT') {
        debug(err)
      } else throw err
    }
  }
}
