import cli from 'cli-ux'
import * as fs from 'fs-extra'
import * as path from 'path'
import RWLockfile, { rwlockfile } from 'rwlockfile'
import _ from 'ts-lodash'

import Config from '../config'
import deps from '../deps'

import { PluginManifest } from './manifest'
import { IPluginOptions, IPluginPJSON, Plugin, PluginType } from './plugin'

function touch(f: string) {
  fs.utimesSync(f, new Date(), new Date())
}

function linkPJSON(root: string): Promise<IPluginPJSON> {
  return deps.file.readJSON(path.join(root, 'package.json'))
}

export interface IManifestPlugin {
  name: string
  root: string
}

async function getNewestJSFile(root: string): Promise<Date> {
  let files = await deps.file.walk(root, {
    depthLimit: 20,
    filter: f => !['.git', 'node_modules'].includes(path.basename(f)),
  })
  return files.reduce((prev, f): Date => {
    if (f.stats.isDirectory()) return prev
    if (f.path.endsWith('.js') || f.path.endsWith('.ts')) {
      if (f.stats.mtime > prev) {
        return f.stats.mtime
      }
    }
    return prev
  }, new Date(0))
}

export class LinkPlugins {
  public plugins: LinkPlugin[]
  private manifest: PluginManifest
  private lock: RWLockfile
  private debug: any

  constructor(private config: Config) {
    this.debug = require('debug')('cli:plugins:user')
    this.manifest = new deps.PluginManifest({
      name: 'link',
      file: path.join(this.config.dataDir, 'plugins', 'link.json'),
    })
    this.lock = new RWLockfile(this.manifest.file, { ifLocked: status => this.debug(status.status) })
  }

  @rwlockfile('lock', 'write')
  public async install(root: string): Promise<void> {
    cli.action.start(`Linking ${root}`)
    await this.init()
    try {
      await this.lock.add('write', { reason: 'install' })
      await this.addPlugin(root)
      cli.action.stop()
    } finally {
      await this.lock.remove('write')
    }
  }

  @rwlockfile('lock', 'write')
  public async uninstall(name: string): Promise<void> {
    await this.init()
    await this.removePlugin(name)
    cli.action.stop()
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
    if (!this.plugins) await this._init()
  }

  @rwlockfile('lock', 'read')
  private async _init(): Promise<void> {
    this.debug('init')
    await this.migrate()
    this.plugins = _.compact(
      await Promise.all(deps.util.objValues(await this.manifestPlugins()).map(v => this.loadPlugin(v.root))),
    )
    if (this.plugins.length) this.debug('plugins:', this.plugins.map(p => p.name).join(', '))
  }

  private async migrate() {
    const linkedPath = path.join(this.config.dataDir, 'linked_plugins.json')
    if (!await deps.file.exists(linkedPath)) return
    try {
      await this.lock.add('write', { reason: 'migrate' })
      cli.action.start('migrating link plugins')
      let linked = await deps.file.readJSON(linkedPath)
      for (let root of linked.plugins) {
        cli.action.status = root
        await this.addPlugin(root)
      }
      cli.action.stop()
      await deps.file.remove(linkedPath)
    } finally {
      await this.lock.remove('write')
    }
  }

  private async addPlugin(root: string) {
    const plugin = await this.loadPlugin(root, true)
    if (!plugin) return
    await deps.file.remove(path.join(this.config.dataDir, 'plugins', 'link', `${plugin.name}.json`))
    await plugin.load()
    let plugins = await this.manifestPlugins()
    plugins[plugin.name] = { root }
    await this.manifest.set('plugins', plugins)
    await this.manifest.save()
    delete this.plugins
  }

  private async removePlugin(name: string) {
    let plugins = await this.manifestPlugins()
    delete plugins[name]
    await this.manifest.set('plugins', plugins)
    await this.manifest.save()
    await deps.file.remove(path.join(this.config.dataDir, 'plugins', 'link', `${name}.json`))
    delete this.plugins
  }

  private async manifestPlugins(): Promise<{ [k: string]: { root: string } }> {
    return (await this.manifest.get('plugins')) || {}
  }

  private async loadPlugin(root: string, refresh = false) {
    if (!await deps.file.exists(root)) return
    let p = new LinkPlugin({
      config: this.config,
      root,
      pjson: await linkPJSON(root),
      type: 'link',
    })
    await p.refresh(refresh)
    return p
  }
}

export class LinkPlugin extends Plugin {
  public type: PluginType = 'link'
  private manifest: PluginManifest

  constructor(opts: IPluginOptions) {
    super(opts)
    this.manifest = new deps.PluginManifest({
      name: 'link',
      file: path.join(this.config.dataDir, 'plugins', 'link', `${this.name}.json`),
    })
  }

  @rwlockfile('lock', 'read')
  public async refresh(force = false) {
    if (force || (await this.updateNodeModulesNeeded())) await this.updateNodeModules()
    else if (await this.prepareNeeded()) await this.prepare()
    deps.validate.pluginPjson(this.pjson, this.pjsonPath)
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

  @rwlockfile('lock', 'write')
  private async updateNodeModules(): Promise<void> {
    if (!cli.action.running) {
      cli.action.start(`Refreshing linked plugin ${this.name}`, 'yarn install')
    }
    this.debug('update node modules')
    const yarn = new deps.Yarn({ config: this.config, cwd: this.root })
    await yarn.exec()
    touch(path.join(this.root, 'node_modules'))
    await this.reset()
  }

  @rwlockfile('lock', 'write')
  private async prepare() {
    if (!cli.action.running) {
      cli.action.start(`Refreshing linked plugin ${this.name}`, 'yarn run prepare')
    }
    const { scripts } = this.pjson
    if (scripts && scripts.prepare) {
      const yarn = new deps.Yarn({ config: this.config, cwd: this.root })
      await yarn.exec(['run', 'prepare'])
    }
    await this.reset()
  }

  private async reset() {
    await this.resetCache()
    await this.manifest.set('lastUpdated', new Date().toISOString())
    await this.manifest.save()
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
