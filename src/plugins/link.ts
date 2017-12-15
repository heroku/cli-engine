import { Config } from 'cli-engine-config'
import { cli } from 'cli-ux'
import { Plugin, PluginOptions, PluginType } from './plugin'
import * as path from 'path'
import * as fs from 'fs-extra'
import { PluginManager } from './manager'
import { PluginManifest } from './manifest'
import deps from '../deps'

const debug = require('debug')('cli:plugins:link')

function touch(f: string) {
  fs.utimesSync(f, new Date(), new Date())
}

export class LinkPlugins extends PluginManager {
  public plugins: LinkedPlugin[]

  private manifest: PluginManifest

  constructor({ config, manifest }: { config: Config; manifest: PluginManifest }) {
    super({ config })
    this.manifest = manifest
  }

  public async install(root: string): Promise<void> {
    const plugin = this.loadPlugin(root, true)
    await plugin.init()
    await plugin.validate()
    await this.manifest.add({ type: 'link', name: plugin.name, root, last_updated: new Date().toISOString() })
    await this.manifest.save()
  }

  public async pjson(root: string) {
    return deps.file.fetchJSONFile(path.join(root, 'package.json'))
  }

  protected async _init() {
    debug('_init')
    await this.manifest.init()
    const defs = this.manifest.list('link')
    const plugins = defs.map(p => this.loadPlugin(p.root))
    this.submanagers = this.plugins = plugins
  }

  private loadPlugin(root: string, forceRefresh: boolean = false) {
    return new LinkedPlugin({
      forceRefresh,
      manifest: this.manifest,
      config: this.config,
      root,
    })
  }
}

export class LinkedPlugin extends Plugin {
  public type: PluginType = 'link'

  private forceRefresh: boolean
  private manifest: PluginManifest

  constructor(opts: { forceRefresh: boolean; manifest: PluginManifest } & PluginOptions) {
    super(opts)
    this.manifest = opts.manifest
    this.forceRefresh = opts.forceRefresh || this.manifest.nodeVersionChanged
  }

  protected async _init() {
    this.debug('_init')
    if (!await deps.file.exists(this.root)) {
      this.debug(`Ignoring ${this.root} as it does not exist`)
      return
    }
    this.pjson = await deps.file.fetchJSONFile(path.join(this.root, 'package.json'))
    await this.refresh()
    await super._init()
  }

  protected async refresh() {
    if (this.forceRefresh || (await this.updateNodeModulesNeeded())) {
      await this.updateNodeModules()
      await this.prepare()
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
    cli.action.stop()
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
    const plugins = this.manifest.list('link')
    if (plugins.find(p => p.root === this.root)) {
      this.manifest.update(this.root)
    }
    cli.action.stop()
  }

  private async dirty(): Promise<boolean> {
    const updatedAt = this.lastUpdated
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

  private get lastUpdated(): Date | undefined {
    const info = this.manifestInfo
    if (info) return new Date(info.last_updated)
  }

  private get manifestInfo() {
    const p = this.manifest.list('link')
    return p.find(p => p.root === this.root)
  }
}
