import deps from '../deps'
import { Config } from 'cli-engine-config'
import * as fs from 'fs-extra'
import * as path from 'path'

const debug = require('debug')('cli:cache')

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
  private mtime?: number

  private saving?: Promise<void>
  public async save(): Promise<void> {
    await this.init()
    if (!this.needsSave) return
    this.needsSave = false
    this.saving = (async () => {
      debug('saving')
      if (!await this.canWrite()) {
        throw new Error('cache file modified, cannot save')
      }
      await deps.file.outputJSON(this.file, this.cache, { spaces: 2 })
    })()
  }

  private fetchPromises: { [k: string]: Promise<any> } = {}
  public async fetch<T>(key: string | undefined, prop: string, fn: () => Promise<T>): Promise<T> {
    if (!key) return fn()
    await this.init()
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

  public async reset(key: string) {
    await this.init()
    delete this.cache.plugins[key]
    this.needsSave = true
  }

  private _init: Promise<void>
  private async init() {
    await this.saving
    if (this._init) return this._init
    return (this._init = (async () => {
      debug('init')
      this.cache = (await this.read()) || {
        version: this.config.userAgent,
        plugins: {},
      }
    })())
  }

  private get file() {
    return path.join(this.config.cacheDir, 'plugins.json')
  }

  private async read(): Promise<CacheJSON | undefined> {
    try {
      this.mtime = await this.getLastUpdated()
      let cache = await fs.readJSON(this.file)
      if (cache.version !== this.config.userAgent) {
        debug('cache version mismatch')
        return
      }
      if (!cache.plugins) this.cache.plugins = {}
      return cache
    } catch (err) {
      if (err.code === 'ENOENT') {
        debug(err)
      } else throw err
    }
  }

  private async canWrite() {
    if (!this.mtime) return true
    return (await this.getLastUpdated()) === this.mtime
  }

  private async getLastUpdated(): Promise<number | undefined> {
    try {
      const stat = await deps.file.stat(this.file)
      return stat.mtime.getTime()
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }
  }
}
