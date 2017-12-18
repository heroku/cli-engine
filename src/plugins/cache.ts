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

  public async save(): Promise<void> {
    await this.init()
    if (!this.needsSave) return
    this.needsSave = false
    await deps.file.outputJSON(this.file, this.cache, { spaces: 2 })
  }

  private fetchPromises: { [k: string]: Promise<any> } = {}
  public async fetch<T>(plugin: Plugin, prop: string, fn: () => Promise<T>): Promise<T> {
    await this.init()
    const key = cacheKey(plugin)
    if (this.fetchPromises[key + prop]) return this.fetchPromises[key + prop]
    return (this.fetchPromises[key + prop] = (async () => {
      if (!this.cache.plugins[key]) {
        this.cache.plugins[key] = {} as CachePlugin
      }
      if (!(prop in this.cache.plugins[key])) {
        debug('fetching', key, prop)
        this.cache.plugins[key][prop] = await fn()
        this.needsSave = true
      }
      return this.cache.plugins[key][prop]
    })())
  }

  public async reset(plugin: Plugin) {
    await this.init()
    console.dir(cacheKey(plugin))
    console.dir(this.cache.plugins[cacheKey(plugin)])
    delete this.cache.plugins[cacheKey(plugin)]
    console.dir(this.cache.plugins[cacheKey(plugin)])
    this.needsSave = true
  }

  private _init: Promise<void>
  private async init() {
    if (this._init) return this._init
    return (this._init = (async () => {
      debug('init')
      this.cache = (await this.read()) || {
        version: this.config.userAgent,
        plugins: {},
      }
      if (!this.cache.plugins) this.cache.plugins = {}
    })())
  }

  private get file() {
    return path.join(this.config.cacheDir, 'plugins.json')
  }

  private async read(): Promise<CacheJSON | undefined> {
    try {
      let cache = await fs.readJSON(this.file)
      if (cache.version !== this.config.userAgent) {
        debug('cache version mismatch')
        return
      }
      return cache
    } catch (err) {
      if (err.code === 'ENOENT') {
        debug(err)
      } else throw err
    }
  }
}
