import { IConfig } from 'cli-engine-config'
import * as fs from 'fs-extra'
import * as path from 'path'
import deps from '../deps'

const debug = require('debug')('cli:cache')

interface ICacheJSON {
  invalidate: string
  cache: { [k: string]: any }
}

export class PluginCache {
  public needsSave: boolean = false
  private cache: ICacheJSON
  private mtime?: number
  private saving?: Promise<void>
  private _init: Promise<void>

  constructor(protected config: IConfig, protected name: string, protected invalidate: string) {}

  public async save(): Promise<void> {
    await this.init()
    if (!this.needsSave) return
    this.needsSave = false
    debug('saving')
    if (!await this.canWrite()) {
      throw new Error('cache file modified, cannot save')
    }
    await deps.file.outputJSON(this.file, this.cache, { spaces: 0 })
  }

  public async fetch<T>(key: string, fn: () => Promise<T>): Promise<T> {
    await this.init()
    let v = await this.get(key)
    if (!v) {
      debug('fetching', key)
      await this.set(key, await fn())
    }
    return await this.get(key)
  }

  public async get(key: string) {
    await this.init()
    return this.cache.cache[key]
  }

  public async set(key: string, v: any) {
    await this.init()
    this.cache.cache[key] = v
    this.needsSave = true
    return this.cache.cache[key]
  }

  public async reset() {
    await deps.file.remove(this.file)
    this.needsSave = true
  }

  private async init() {
    await this.saving
    if (this._init) return this._init
    return (this._init = (async () => {
      debug('init')
      this.cache = (await this.read()) || {
        invalidate: this.invalidate,
        cache: {},
      }
    })())
  }

  private get file() {
    return path.join(this.config.cacheDir, 'plugins', this.name, 'plugins.json')
  }

  private async read(): Promise<ICacheJSON | undefined> {
    try {
      this.mtime = await this.getLastUpdated()
      let cache = await fs.readJSON(this.file)
      if (cache.invalidate !== this.invalidate) {
        debug('cache version mismatch')
        return
      }
      if (!cache.cache) this.cache.cache = {}
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
