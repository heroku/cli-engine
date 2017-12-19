import deps from '../deps'
import { Config } from 'cli-engine-config'
import * as path from 'path'

const debug = require('debug')('cli:plugins:manifest')

export interface ManifestLink {
  name: string
  root: string
  lastUpdated: Date
}

export interface ManifestUser {
  name: string
  tag: string
}

export interface ManifestUserOpts {
  type: 'user'
  name: string
  tag: string
}

export interface ManifestLinkOpts {
  type: 'link'
  name: string
  root: string
}

export type ManifestJSON = {
  version: 1
  node_version?: string
  user: ManifestUser[]
  link: {
    name: string
    root: string
    last_updated: string
  }[]
}

export class PluginManifest {
  constructor(config: Config) {
    this.config = config
  }

  public config: Config
  public nodeVersionChanged: boolean = false
  public needsSave: boolean = false
  public mtime?: number

  private saving: Promise<void>
  public async save(): Promise<void> {
    if (!this.needsSave) return
    this.needsSave = false
    return (this.saving = (async () => {
      debug('saving')
      if (!await this.canWrite()) {
        throw new Error('manifest file modified, cannot save')
      }
      await deps.file.outputJSON(this.file, this.manifest, { spaces: 2 })
      delete this._init
    })())
  }

  public async list(type: 'user'): Promise<ManifestUser[]>
  public async list(type: 'link'): Promise<ManifestLink[]>
  public async list(type: 'user' | 'link'): Promise<any> {
    await this.init()
    if (type === 'user') return this.manifest.user
    return this.manifest.link.map(p => ({
      ...p,
      lastUpdated: new Date(p.last_updated),
    }))
  }

  public async add(opts: ManifestUserOpts | ManifestLinkOpts) {
    await this.init()
    await this.remove(opts.name)
    if (opts.type === 'user') {
      this.manifest.user.push({ name: opts.name, tag: opts.tag })
    } else {
      this.manifest.link.push({ name: opts.name, root: opts.root, last_updated: new Date().toISOString() })
    }
    this.needsSave = true
  }

  public async remove(name: string) {
    await this.init()
    this.manifest.user = this.manifest.user.filter(p => p.name !== name)
    this.manifest.link = this.manifest.link.filter(p => p.name !== name)
    this.needsSave = true
  }

  public async update(name: string) {
    await this.init()
    let p = this.manifest.link.find(p => [p.name, p.root].includes(name))
    if (!p) throw new Error(`${name} not found in manifest`)
    p.last_updated = new Date().toISOString()
    this.needsSave = true
  }

  private manifest: ManifestJSON
  private _init: Promise<void>
  public async init() {
    await this.saving
    if (this._init) return this._init
    return (this._init = (async () => {
      debug('init')
      this.manifest = (await this.read()) || {
        version: 1,
        link: [],
        user: [],
      }
      if (!this.manifest.link) this.manifest.link = []
      if (!this.manifest.user) this.manifest.user = []
      this.nodeVersionChanged = this.manifest.node_version !== process.versions.node
      if (this.nodeVersionChanged) {
        this.manifest.node_version = process.versions.node
        this.needsSave = true
      }
    })())
  }

  private get file() {
    return path.join(this.config.dataDir, 'plugins', 'plugins.json')
  }

  private async read(): Promise<ManifestJSON | undefined> {
    try {
      this.mtime = await this.getLastUpdated()
      return await deps.file.readJSON(this.file)
    } catch (err) {
      if (err.code === 'ENOENT') {
        debug(err)
      } else {
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
