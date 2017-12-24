import { IConfig } from 'cli-engine-config'
import * as fs from 'fs-extra'
import * as path from 'path'
import deps from '../deps'
import { Lock } from '../lock'
import { PluginManifest } from './manifest'
import { IPluginPJSON, Plugin, PluginType } from './plugin'

function touch(f: string) {
  fs.utimesSync(f, new Date(), new Date())
}

function linkPJSON(root: string): Promise<IPluginPJSON> {
  return deps.file.fetchJSONFile(path.join(root, 'package.json'))
}

export interface IManifestPlugin {
  name: string
  root: string
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

export class LinkPlugins {
  public plugins: LinkPlugin[]
  private manifest: PluginManifest
  private lock: Lock
  private debug: any

  constructor(private config: IConfig) {
    this.debug = require('debug')('cli:plugins:user')
  }

  public async install(root: string): Promise<void> {
    await this.init()
    await this.lock.write()
    this.debug('installing', root)
    const plugin = await this.loadPlugin(root)
    await plugin.init()
    await plugin.refresh(true)
    await plugin.load()
    await this.addPlugin(plugin.name, plugin.root)
    await this.lock.unwrite()
  }

  public async findByRoot(root: string): Promise<LinkPlugin | undefined> {
    await this.init()
    root = path.resolve(root)
    return this.plugins.find(p => path.resolve(p.root) === root)
  }

  public async submanagers() {
    await this.init()
    return this.plugins
  }

  public async init(): Promise<void> {
    if (this.plugins) return
    this.debug('init')
    this.manifest = new deps.PluginManifest({
      name: 'link',
      file: path.join(this.config.dataDir, 'plugins', 'link.json'),
    })
    this.lock = new deps.Lock(this.config, this.manifest.file + '.lock')
    await this.lock.read()
    await this.migrate()
    const manifest = await this.manifest.get('plugins')
    this.plugins = await Promise.all(Object.values(manifest || {}).map(v => this.loadPlugin(v.root)))
    if (this.plugins.length) this.debug('plugins:', this.plugins.map(p => p.name).join(', '))
    await this.lock.unread()
  }

  private async migrate() {
    const linkedPath = path.join(this.config.dataDir, 'linked_plugins.json')
    if (!await deps.file.exists(linkedPath)) return
    await this.lock.write()
    this.debug('migrating link plugins')
    let linked = await deps.file.readJSON(linkedPath)
    for (let root of linked.plugins) {
      const name = await deps.file.readJSON(path.join(root, 'package.json'))
      await this.addPlugin(name, root)
    }
    await deps.file.remove(linkedPath)
    await this.lock.unwrite()
  }

  private async addPlugin(name: string, root: string) {
    let plugins = (await this.manifest.get('plugins')) || {}
    plugins[name] = { root }
    await this.manifest.set('plugins', plugins)
    await this.manifest.save()
  }

  private async loadPlugin(root: string) {
    let p = new LinkPlugin({
      config: this.config,
      root,
      pjson: await linkPJSON(root),
    })
    await p.init()
    return p
  }
}

export class LinkPlugin extends Plugin {
  public type: PluginType = 'link'
  protected lock: Lock
  private manifest: PluginManifest

  public async resetCache() {
    await this.init()
    await this.lock.write()
    await super.resetCache()
    await this.manifest.set('lastUpdated', new Date().toISOString())
    await this.manifest.save()
    await this.lock.unwrite()
  }

  public async refresh(force = false) {
    if (force || (await this.updateNodeModulesNeeded())) await this.updateNodeModules()
    else if (await this.prepareNeeded()) await this.prepare()
  }

  public async init(forceRefresh = false) {
    if (this.manifest) return
    await super.init()
    this.manifest = new deps.PluginManifest({
      name: 'link',
      file: path.join(this.config.dataDir, 'plugins', 'link', `${this.name}.json`),
    })
    await this.refresh(forceRefresh)
  }

  private async updateNodeModulesNeeded(): Promise<boolean> {
    if ((await this.yarnNodeVersion()) !== process.version) return true
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
    await this.lock.write()
    this.debug('update node modules')
    const yarn = new deps.Yarn({ config: this.config, cwd: this.root })
    await yarn.exec()
    touch(path.join(this.root, 'node_modules'))
    await this.resetCache()
    await this.lock.unwrite()
  }

  private async prepare() {
    await this.lock.write()
    this.debug('prepare')
    const { scripts } = this.pjson
    if (!scripts || !scripts.prepare) return
    const yarn = new deps.Yarn({ config: this.config, cwd: this.root })
    await yarn.exec(['run', 'prepare'])
    await this.resetCache()
    await this.lock.unwrite()
  }

  private async lastUpdated(): Promise<Date> {
    const lastUpdated = await this.manifest.get('lastUpdated')
    return lastUpdated ? new Date(lastUpdated) : new Date(0)
  }

  private async yarnNodeVersion(): Promise<string | undefined> {
    try {
      let f = await deps.file.readJSON(path.join(this.root, 'node_modules', '.yarn-integrity'))
      return f.nodeVersion
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }
  }
}
