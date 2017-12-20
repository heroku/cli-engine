import { Plugin, PluginPJSON, PluginOptions, PluginType } from './plugin'
import * as path from 'path'
import * as fs from 'fs-extra'
import { PluginManager } from './manager'
import deps from '../deps'

function touch(f: string) {
  fs.utimesSync(f, new Date(), new Date())
}

function linkPJSON(root: string): Promise<PluginPJSON> {
  return deps.file.fetchJSONFile(path.join(root, 'package.json'))
}

async function getNewestJSFile(root: string): Promise<Date> {
  let files = await deps.file.walk(root, {
    depthLimit: 10,
    filter: f => !['.git', 'node_modules'].includes(path.basename(f)),
  })
  return files.reduce((prev, f): Date => {
    if (f.stats.isDirectory()) return prev
    if (f.path.endsWith('.js') || f.path.endsWith('.ts')) {
      if (f.stats.mtime > prev) return f.stats.mtime
    }
    return prev
  }, new Date(0))
}

export class LinkPlugins extends PluginManager {
  public plugins: LinkPlugin[]

  public async install(root: string): Promise<void> {
    this.debug('installing', root)
    const plugin = await this.loadPlugin(root, true)
    await plugin.refresh()
    await plugin.init()
  }

  public async findByRoot(root: string): Promise<LinkPlugin | undefined> {
    await this.init()
    root = path.resolve(root)
    return this.plugins.find(p => path.resolve(p.root) === root)
  }

  protected async _init(): Promise<void> {
    this.debug('init')
    const defs = await this.manifest.list('link')
    const promises = defs.map(p => this.loadPlugin(p.root))
    this.submanagers = this.plugins = await Promise.all(promises)
    if (this.plugins.length) this.debug('plugins:', this.plugins.map(p => p.name).join(', '))
  }

  private async loadPlugin(root: string, forceRefresh: boolean = false) {
    const pjson = await linkPJSON(root)
    return new LinkPlugin({
      name: pjson.name,
      cache: this.cache,
      type: 'link',
      config: this.config,
      forceRefresh,
      manifest: this.manifest,
      root,
      version: pjson.version,
      pjson,
    })
  }
}

export class LinkPlugin extends Plugin {
  public type: PluginType = 'link'
  private forceRefresh: boolean

  constructor(opts: { forceRefresh: boolean } & PluginOptions) {
    super(opts)
    this.forceRefresh = opts.forceRefresh
  }

  protected async resetCache() {
    await super.resetCache()
    const plugin = await this.manifestInfo()
    if (plugin) await this.manifest.update('link', plugin.name)
  }

  protected async _refresh() {
    let type = await this.refreshType()
    switch (type) {
      case 'node_modules':
        await this.updateNodeModules()
        break
      case 'prepare':
        await this.prepare()
        break
    }
    await super._refresh()
  }

  protected async _needsRefresh() {
    if (await this.refreshType()) return true
    return super._needsRefresh()
  }

  private async refreshType(): Promise<'node_modules' | 'prepare' | undefined> {
    if (this.forceRefresh || this.manifest.nodeVersionChanged) return 'node_modules'
    if (await this.updateNodeModulesNeeded()) return 'node_modules'
    if (await this.prepareNeeded()) return 'prepare'
  }

  private async updateNodeModulesNeeded(): Promise<boolean> {
    let modules = path.join(this.root, 'node_modules')
    if (!await deps.file.exists(modules)) return true
    let modulesInfo = await fs.stat(modules)
    let pjsonInfo = await fs.stat(path.join(this.root, 'package.json'))
    return modulesInfo.mtime < pjsonInfo.mtime
  }

  private async prepareNeeded(): Promise<boolean> {
    const main = this.pjson.main
    if (main && !await deps.file.exists(path.join(this.root, main))) return true
    return (await this.lastUpdated()) < (await getNewestJSFile(this.root))
  }

  private async updateNodeModules(): Promise<void> {
    this.debug('update node modules')
    const yarn = new deps.Yarn({ config: this.config, cwd: this.root })
    await yarn.exec()
    touch(path.join(this.root, 'node_modules'))
    await this.resetCache()
  }

  private async prepare() {
    this.debug('prepare')
    const { scripts } = this.pjson
    if (!scripts || !scripts.prepare) return
    const yarn = new deps.Yarn({ config: this.config, cwd: this.root })
    await yarn.exec(['run', 'prepare'])
    await this.resetCache()
  }

  private async lastUpdated(): Promise<Date> {
    const plugin = await this.manifestInfo()
    if (!plugin) return new Date(0)
    return plugin.lastUpdated
  }

  private async manifestInfo() {
    const plugins = await this.manifest.list('link')
    const plugin = plugins.find(p => p.root === this.root)
    return plugin
  }
}
