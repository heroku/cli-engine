import { Config } from 'cli-engine-config'
import * as fs from 'fs-extra'
import * as path from 'path'

const debug = require('debug')('cli:plugins:repo')

export type RepoLink = {
  name: string
  root: string
  lastUpdated: string
}

export type RepoUser = {
  name: string
  tag: string
}

export type RepoUserOpts = RepoUser & { type: 'user' }
export type RepoLinkOpts = RepoLink & { type: 'link' }

export type RepoJSON = {
  version: 1
  node_version?: string
  user: RepoUser[]
  link: RepoLink[]
}

export class PluginRepo {
  constructor(config: Config) {
    this.config = config
  }

  public config: Config

  public async init() {
    if (this.repo) return
    this.repo = (await this.read()) || {
      version: 1,
      link: [],
      user: [],
    }
    if (!this.repo.link) this.repo.link = []
    if (!this.repo.user) this.repo.user = []
  }

  public async save(): Promise<void> {
    this.repo.node_version = process.versions.node
    await fs.outputJSON(this.file, this.repo, { spaces: 2 })
  }

  public async list(type: 'user'): Promise<RepoJSON['user']>
  public async list(type: 'link'): Promise<RepoJSON['link']>
  public async list(type: 'user' | 'link'): Promise<any> {
    await this.init()
    if (type === 'user') return this.repo.user
    else return this.repo.link
  }

  public get nodeVersionChanged(): boolean {
    return this.repo.node_version !== process.versions.node
  }

  public async add(opts: RepoUserOpts | RepoLinkOpts): Promise<void> {
    await this.remove(opts.name)
    if (opts.type === 'user') {
      this.repo.user.push({ name: opts.name, tag: opts.tag })
    } else {
      this.repo.link.push({ name: opts.name, root: opts.root, lastUpdated: opts.lastUpdated })
    }
  }

  public async remove(name: string): Promise<void> {
    this.repo.user = this.repo.user.filter(p => p.name !== name)
    this.repo.link = this.repo.link.filter(p => p.name !== name)
  }

  private repo: RepoJSON

  private get file() {
    return path.join(this.config.dataDir, 'plugins', 'plugins.json')
  }

  private async read(): Promise<RepoJSON | undefined> {
    try {
      return await fs.readJSON(this.file)
    } catch (err) {
      if (err.code === 'ENOENT') {
        debug(err)
      } else throw err
    }
  }
}
