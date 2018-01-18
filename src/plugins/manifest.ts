import * as fs from 'fs-extra'

import deps from '../deps'

export interface IManifestOpts {
  file: string
  invalidate?: string
  name: string
}

export class PluginManifest {
  public needsSave: boolean = false
  public file: string
  public invalidate: string | undefined
  public name: string
  private body: { [k: string]: any }
  private mtime?: number
  private saving?: Promise<void>
  private debug: any

  constructor(opts: IManifestOpts) {
    this.file = opts.file
    this.invalidate = opts.invalidate
    this.name = opts.name
    this.debug = require('debug')(`cli:manifest:${this.name}`)
  }

  public async save(): Promise<void> {
    await this.init()
    if (!this.needsSave) return
    this.needsSave = false
    this.debug('saving')
    if (!await this.canWrite()) {
      throw new Error(`manifest file ${this.file} modified, cannot save`)
    }
    await deps.file.outputJSON(this.file, this.body)
    delete this.body
    delete this.mtime
  }

  public async fetch<T>(key: string, fn: () => Promise<T>): Promise<T> {
    await this.init()
    let v = await this.get(key)
    if (!v) {
      this.debug('fetching', key)
      const value = await fn()
      try {
        await this.set(key, value)
        if (await this.canWrite()) await this.save()
      } catch (err) {
        this.debug(err)
        return value
      }
    }
    return await this.get(key)
  }

  public async get(key: string) {
    await this.init()
    return this.body.manifest[key]
  }

  public async set(key: string, v: any) {
    this.debug('set', key)
    if (!key) throw new Error('key is empty')
    await this.init()
    this.body.manifest[key] = v
    this.needsSave = true
    return this.body.manifest[key]
  }

  public async reset() {
    this.debug('reset')
    await deps.file.remove(this.file)
    delete this.body
    this.needsSave = false
  }

  private async init() {
    await this.saving
    if (this.body) return this.body
    this.body = (await this.read()) || {
      invalidate: this.invalidate,
      manifest: {},
    }
  }

  private async read(): Promise<any> {
    try {
      this.mtime = await this.getLastUpdated()
      let body = await fs.readJSON(this.file)
      if (body.invalidate !== this.invalidate) {
        this.debug('manifest version mismatch')
        return
      }
      if (!body.manifest) this.body.manifest = {}
      return body
    } catch (err) {
      if (err.code === 'ENOENT') this.debug('manifest not found')
      else {
        await deps.file.remove(this.file)
        throw err
      }
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
