import { Config } from 'cli-engine-config'
import * as fs from 'fs-extra'
import * as path from 'path'

const debug = require('debug')('cli:plugins:manifest')

export type ManifestLink = {
  name: string
  root: string
  lastUpdated: string
}

export type ManifestUser = {
  name: string
  tag: string
}

export type ManifestUserOpts = ManifestUser & { type: 'user' }
export type ManifestLinkOpts = ManifestLink & { type: 'link' }

export type ManifestJSON = {
  version: 1
  node_version?: string
  user: ManifestUser[]
  link: ManifestLink[]
}

export class PluginManifest {
  constructor(config: Config) {
    this.config = config
  }

  public config: Config

  public async init() {
    if (this.manifest) return
    this.manifest = (await this.read()) || {
      version: 1,
      link: [],
      user: [],
    }
    if (!this.manifest.link) this.manifest.link = []
    if (!this.manifest.user) this.manifest.user = []
  }

  public async save(): Promise<void> {
    this.manifest.node_version = process.versions.node
    await fs.outputJSON(this.file, this.manifest, { spaces: 2 })
  }

  public async list(type: 'user'): Promise<ManifestJSON['user']>
  public async list(type: 'link'): Promise<ManifestJSON['link']>
  public async list(type: 'user' | 'link'): Promise<any> {
    await this.init()
    if (type === 'user') return this.manifest.user
    else return this.manifest.link
  }

  public get nodeVersionChanged(): boolean {
    return this.manifest.node_version !== process.versions.node
  }

  public async add(opts: ManifestUserOpts | ManifestLinkOpts): Promise<void> {
    await this.remove(opts.name)
    if (opts.type === 'user') {
      this.manifest.user.push({ name: opts.name, tag: opts.tag })
    } else {
      this.manifest.link.push({ name: opts.name, root: opts.root, lastUpdated: opts.lastUpdated })
    }
  }

  public async remove(name: string): Promise<void> {
    this.manifest.user = this.manifest.user.filter(p => p.name !== name)
    this.manifest.link = this.manifest.link.filter(p => p.name !== name)
  }

  private manifest: ManifestJSON

  private get file() {
    return path.join(this.config.dataDir, 'plugins', 'plugins.json')
  }

  private async read(): Promise<ManifestJSON | undefined> {
    try {
      return await fs.readJSON(this.file)
    } catch (err) {
      if (err.code === 'ENOENT') {
        debug(err)
      } else throw err
    }
  }
}
