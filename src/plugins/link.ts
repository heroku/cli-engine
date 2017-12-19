import { cli } from 'cli-ux'
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
  let newest = new Date(0)
  return new Promise<Date>((resolve, reject) => {
    deps
      .klaw(root, {
        depthLimit: 10,
        filter: f => {
          return !['.git', 'node_modules'].includes(path.basename(f))
        },
      })
      .on('data', f => {
        if (f.stats.isDirectory()) return
        if (f.path.endsWith('.js') || f.path.endsWith('.ts')) {
          if (f.stats.mtime > newest) newest = f.stats.mtime
        }
      })
      .on('error', reject)
      .on('end', () => resolve(newest))
  })
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
    const defs = await this.manifest.list('link')
    const promises = defs.map(p => this.loadPlugin(p.root))
    this.submanagers = this.plugins = await Promise.all(promises)
    await this.refreshPlugins()
  }

  private async refreshPlugins() {
    let toRefresh = []
    for (let p of this.plugins) {
      let refresh = await p.needsRefresh
      if (refresh) toRefresh.push(p)
    }
    if (!toRefresh.length) return
    const downgrade = await this.lock.upgrade()
    for (let p of toRefresh.map(p => p.refresh())) {
      toRefresh = toRefresh.filter(p => p.needsRefresh)
      cli.action.start(
        `Updating linked plugin${toRefresh.length > 1 ? 's' : ''}: ${toRefresh.map(p => p.root).join('\n')}`,
      )
      await p
    }
    cli.action.start('Updating linked plugins')
    await this.cache.save()
    await downgrade()
    cli.action.stop()
  }

  private async loadPlugin(root: string, forceRefresh: boolean = false) {
    const pjson = await linkPJSON(root)
    return new LinkPlugin({
      name: pjson.name,
      cache: this.cache,
      type: 'link',
      config: this.config,
      forceRefresh,
      lock: this.lock,
      root,
      version: pjson.version,
      pjson,
    })
  }
}

export class LinkPlugin extends Plugin {
  public type: PluginType = 'link'

  public needsRefresh: Promise<'node_modules' | 'prepare' | undefined>

  constructor(opts: { pjson: any; forceRefresh: boolean } & PluginOptions) {
    super(opts)
    this.pjson = opts.pjson
    this.needsRefresh = (async () => {
      if (opts.forceRefresh) return 'node_modules'
      if (await this.updateNodeModulesNeeded()) return 'node_modules'
      if (await this.prepareNeeded()) return 'prepare'
    })()
  }

  public async refresh() {
    switch (await this.needsRefresh) {
      case 'node_modules':
        return this.updateNodeModules()
      case 'prepare':
        return this.prepare()
    }
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
    const yarn = new deps.Yarn({ config: this.config, cwd: this.root })
    await yarn.exec()
    touch(path.join(this.root, 'node_modules'))
    await this.saveCache()
  }

  private async prepare() {
    const { scripts } = this.pjson
    if (!scripts || !scripts.prepare) return
    const yarn = new deps.Yarn({ config: this.config, cwd: this.root })
    await yarn.exec(['run', 'prepare'])
    await this.saveCache()
  }

  private async lastUpdated(): Promise<Date> {
    const s = await this.cache.get(this.cacheKey, 'last_updated')
    return new Date(s || 0)
  }

  private async saveCache() {
    await this.cache.reset(this.cacheKey)
    await this.cache.set(this.cacheKey, 'last_updated', new Date().toISOString())
    await this._init()
    await this.load()
    delete this.needsRefresh
  }
}
