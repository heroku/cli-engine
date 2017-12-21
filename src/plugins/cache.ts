import { IConfig } from 'cli-engine-config'
import * as fs from 'fs-extra'
import * as path from 'path'
import deps from '../deps'

const debug = require('debug')('cli:cache')

export interface ICachePlugin {
  [k: string]: any
  name: string
  type: string
}

export interface ICacheJSON {
  version: string
  plugins: { [k: string]: ICachePlugin }
}

export class PluginCache {
  public needsSave: boolean = false
  private cache: ICacheJSON
  private mtime?: number
  private saving?: Promise<void>
  private fetchPromises: { [k: string]: Promise<any> } = {}
  private _init: Promise<void>

  constructor(protected config: IConfig) {}

  public async save(): Promise<void> {
    await this.init()
    if (!this.needsSave) return
    this.needsSave = false
    this.saving = (async () => {
      debug('saving')
      if (!await this.canWrite()) {
        throw new Error('cache file modified, cannot save')
      }
      await deps.file.outputJSON(this.file, this.cache, { spaces: 0 })
    })()
  }

  public async fetch<T>(key: string, prop: string, fn: () => Promise<T>): Promise<T> {
    await this.init()
    if (this.fetchPromises[key + prop]) return this.fetchPromises[key + prop]
    return (this.fetchPromises[key + prop] = (async () => {
      let v = await this.get(key, prop)
      if (!v) {
        debug('fetching', key, prop)
        await this.set(key, prop, await fn())
      }
      return await this.get(key, prop)
    })())
  }

  public async get(key: string, prop: string) {
    await this.init()
    if (!this.cache.plugins[key]) return
    return this.cache.plugins[key][prop]
  }

  public async set(key: string, prop: string, v: any) {
    await this.init()
    if (!this.cache.plugins[key]) {
      this.cache.plugins[key] = {} as ICachePlugin
    }
    this.cache.plugins[key][prop] = v
    this.needsSave = true
    return this.cache.plugins[key][prop]
  }

  public async reset(key: string) {
    await this.init()
    delete this.cache.plugins[key]
    this.fetchPromises = {}
    this.needsSave = true
  }

  private async init() {
    await this.saving
    if (this._init) return this._init
    return (this._init = (async () => {
      debug('init')
      this.cache = (await this.read()) || {
        plugins: {},
        version: this.config.version,
      }
    })())
  }

  private get file() {
    return path.join(this.config.cacheDir, 'plugins.json')
  }

  private async read(): Promise<ICacheJSON | undefined> {
    try {
      this.mtime = await this.getLastUpdated()
      let cache = await fs.readJSON(this.file)
      if (cache.version !== this.config.version) {
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
