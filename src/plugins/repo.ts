import { Config } from 'cli-engine-config'
import * as fs from 'fs-extra'
import * as path from 'path'

const debug = require('debug')('cli-engine:pluginrepo')

export type RepoJSON = {
  version: 1
  node_version: string
  user: {
    name: string
    tag: string
  }[]
  link: {
    name: string
    root: string
    lastUpdated: string
  }[]
}

export class PluginRepo {
  constructor(config: Config) {
    this.config = config
  }

  public config: Config

  public async list(type: 'user'): Promise<RepoJSON['user']>
  public async list(type: 'link'): Promise<RepoJSON['link']>
  public async list(type: 'user' | 'link'): Promise<any> {
    await this.init()
    if (type === 'user') return this.repo.user
    else return this.repo.link
  }

  public async nodeVersion(): Promise<string> {
    await this.init()
    return this.repo.node_version
  }

  public async updateNodeVersion(): Promise<void> {
    await this.init()
    this.repo.node_version = process.versions.node
    await this.write(this.repo)
  }

  public async add(
    opts: RepoJSON['user'][0] & { type: 'user' } | RepoJSON['link'][0] & { type: 'link' },
  ): Promise<void> {
    await this.init()
    await this.remove(opts.name)
    if (opts.type === 'user') {
      this.repo.user.push({ name: opts.name, tag: opts.tag })
    } else {
      this.repo.link.push({ name: opts.name, root: opts.root, lastUpdated: opts.lastUpdated })
    }
    await this.write(this.repo)
  }

  public async remove(name: string): Promise<void> {
    await this.init()
    this.repo.user = this.repo.user.filter(p => p.name !== name)
    this.repo.link = this.repo.link.filter(p => p.name !== name)
    await this.write(this.repo)
  }

  private repo: RepoJSON

  private async init() {
    if (this.repo) return
    this.repo = (await this.read()) || {
      version: 1,
      node_version: process.versions.node,
      link: [],
      user: [],
    }
    if (!this.repo.link) this.repo.link = []
    if (!this.repo.user) this.repo.user = []
  }

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

  private async write(repo: RepoJSON): Promise<void> {
    await fs.outputJSON(this.file, repo, { spaces: 2 })
  }
}
