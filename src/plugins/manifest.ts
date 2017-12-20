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
    lastUpdated: string
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
      await deps.file.outputJSON(this.file, this.manifest)
      delete this._init
    })())
  }

  public async list(type: 'user'): Promise<ManifestUser[]>
  public async list(type: 'link'): Promise<ManifestLink[]>
  public async list(type: 'user' | 'link'): Promise<any> {
    await this.init()
    if (type === 'user') return this.manifest.user
    return this.manifest.link.map(l => ({
      ...l,
      lastUpdated: new Date(l.lastUpdated),
    }))
  }

  public async add(opts: ManifestUserOpts | ManifestLinkOpts) {
    await this.init()
    await this.remove(opts.name)
    if (opts.type === 'user') {
      this.manifest.user.push({ name: opts.name, tag: opts.tag })
    } else {
      this.manifest.link.push({ name: opts.name, root: opts.root, lastUpdated: new Date().toISOString() })
    }
    this.needsSave = true
  }

  public async remove(name: string) {
    await this.init()
    this.manifest.user = this.manifest.user.filter(p => p.name !== name)
    this.manifest.link = this.manifest.link.filter(p => p.name !== name)
    this.needsSave = true
  }

  public async update(type: 'link', name: string) {
    await this.init()
    if (type === 'link') {
      let link = this.manifest.link.find(p => [p.name, p.root].includes(name))
      if (!link) throw new Error(`${name} not found`)
      await this.add({ type, name: link.name, root: link.root })
    }
  }

  private manifest: ManifestJSON
  private _init: Promise<void>
  public async init() {
    await this.saving
    if (this._init) return this._init
    return (this._init = (async () => {
      debug('init')
      this.manifest = await this.read()
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

  private async read(): Promise<ManifestJSON> {
    try {
      this.mtime = await this.getLastUpdated()
      const manifest = await deps.file.readJSON(this.file)
      if (!manifest.link) this.manifest.link = []
      if (!manifest.user) this.manifest.user = []
      return manifest
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
      return {
        version: 1,
        node_version: process.versions.node,
        link: [],
        user: [],
      }
    }
  }

  private async canWrite() {
    if (!this.mtime) return true
    return (await this.getLastUpdated()) === this.mtime
  }

  public async getLastUpdated(): Promise<number | undefined> {
    try {
      const stat = await deps.file.stat(this.file)
      return stat.mtime.getTime()
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }
  }
}
