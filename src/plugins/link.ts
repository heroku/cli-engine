import { Config } from 'cli-engine-config'
import { cli } from 'cli-ux'
import { Plugin, PluginOptions, PluginType } from './plugin'
import * as path from 'path'
import * as fs from 'fs-extra'
import { PluginManager } from './manager'
import { PluginManifest } from './manifest'
import { PluginCache } from './cache'
import deps from '../deps'

function touch(f: string) {
  fs.utimesSync(f, new Date(), new Date())
}

export class LinkPlugins extends PluginManager {
  public plugins: LinkPlugin[]
  private manifest: PluginManifest
  private cache?: PluginCache

  constructor({ config, manifest, cache }: { config: Config; manifest: PluginManifest; cache?: PluginCache }) {
    super({ config })
    this.manifest = manifest
    this.cache = cache
  }

  public async install(root: string): Promise<void> {
    this.debug('installing', root)
    const plugin = this.loadPlugin(root, true)
    await plugin.init()
    await this.manifest.add({ type: 'link', name: plugin.name, root, last_updated: new Date().toISOString() })
    await this.manifest.save()
  }

  public async pjson(root: string) {
    return deps.file.fetchJSONFile(path.join(root, 'package.json'))
  }

  public async findByRoot(root: string): Promise<LinkPlugin | undefined> {
    await this.init()
    root = path.resolve(root)
    return this.plugins.find(p => path.resolve(p.root) === root)
  }

  protected async _init(): Promise<void> {
    const defs = await this.manifest.list('link')
    this.submanagers = this.plugins = defs.map(p => this.loadPlugin(p.root))
  }

  private loadPlugin(root: string, forceRefresh: boolean = false) {
    return new LinkPlugin({
      config: this.config,
      cache: this.cache,
      forceRefresh,
      manifest: this.manifest,
      root,
    })
  }
}

export class LinkPlugin extends Plugin {
  public type: PluginType = 'link'

  private forceRefresh: boolean
  private manifest: PluginManifest

  constructor(opts: { forceRefresh: boolean; manifest: PluginManifest } & PluginOptions) {
    super(opts)
    this.manifest = opts.manifest
    this.forceRefresh = opts.forceRefresh || this.manifest.nodeVersionChanged
  }

  public async init() {
    if (!await deps.file.exists(this.root)) {
      this.debug(`Ignoring ${this.root} as it does not exist`)
      return
    }
    this.pjson = await deps.file.fetchJSONFile(path.join(this.root, 'package.json'))
    await this.refresh()
    await super.init()
  }

  protected async refresh() {
    if (this.forceRefresh || (await this.updateNodeModulesNeeded())) {
      await this.updateNodeModules()
    } else if (await this.prepareNeeded()) {
      await this.prepare()
    }
  }

  private async updateNodeModulesNeeded(): Promise<boolean> {
    let modules = path.join(this.root, 'node_modules')
    if (!await deps.file.exists(modules)) return true
    let modulesInfo = await fs.stat(modules)
    let pjsonInfo = await fs.stat(path.join(this.root, 'package.json'))
    return modulesInfo.mtime < pjsonInfo.mtime
  }

  private async updateNodeModules(): Promise<void> {
    cli.action.start(`Installing node modules for ${this.root}`)
    const yarn = new deps.Yarn({ config: this.config, cwd: this.root })
    await yarn.exec()
    touch(path.join(this.root, 'node_modules'))
    await this.prepare()
  }

  private async prepareNeeded(): Promise<boolean> {
    const main = this.pjson.main
    if (main && !await deps.file.exists(path.join(this.root, main))) return true
    return this.dirty()
  }

  private async prepare() {
    const { scripts } = this.pjson
    if (!scripts || !scripts.prepare) return
    cli.action.start(`Running prepare script for ${this.root}`)
    const yarn = new deps.Yarn({ config: this.config, cwd: this.root })
    await yarn.exec(['run', 'prepare'])
    if (await this.manifestInfo()) {
      await this.manifest.update(this.root)
    }
    if (this.cache) await this.cache.reset(this)
    cli.action.stop()
  }

  private async dirty(): Promise<boolean> {
    const updatedAt = await this.lastUpdated()
    if (!updatedAt) return true
    return new Promise<boolean>((resolve, reject) => {
      deps
        .klaw(this.root, {
          depthLimit: 10,
          filter: f => {
            return !['.git', 'node_modules'].includes(path.basename(f))
          },
        })
        .on('data', f => {
          if (f.stats.isDirectory()) return
          if (f.path.endsWith('.js') || f.path.endsWith('.ts')) {
            if (f.stats.mtime > updatedAt) {
              this.debug(`${f.path} has been updated, preparing linked plugin`)
              resolve(true)
            }
          }
        })
        .on('error', reject)
        .on('end', () => resolve(false))
    })
  }

  private async lastUpdated(): Promise<Date | undefined> {
    const info = await this.manifestInfo()
    if (info) return new Date(info.last_updated)
  }

  private async manifestInfo() {
    const p = await this.manifest.list('link')
    return p.find(p => p.root === this.root)
  }
}
