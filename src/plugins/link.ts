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

function pjsonPath(root: string) {
  return path.join(root, 'package.json')
}

function linkPJSON(root: string): Promise<IPluginPJSON> {
  return deps.file.readJSON(pjsonPath(root))
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

export class NoCommandsError extends Error {
  code = 'ENOCOMMANDS'

  constructor(name: string) {
    super(`${name} has no commands. Is this a CLI plugin?`)
  }
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
    this.lock = new RWLockfile(this.manifest.file, { ifLocked: () => cli.action.start('Link plugins updating') })
  }

  @rwlockfile('lock', 'write')
  public async install(root: string): Promise<void> {
    cli.action.start(`Linking ${root}`)
    await this.init()
    try {
      await this.lock.add('write', { reason: 'install' })
      await this.addPlugin(root)
      // TODO: if (!commands.length) throw new NoCommandsError(this.name)
      cli.action.stop()
    } finally {
      await this.lock.remove('write')
    }
  }

  @rwlockfile('lock', 'write')
  public async uninstall(nameOrRoot: string): Promise<boolean> {
    let plugins = await this.manifestPlugins()
    let deleted
    if (nameOrRoot in plugins) {
      delete plugins[nameOrRoot]
      deleted = nameOrRoot
    } else {
      const root = path.resolve(nameOrRoot)
      for (let name of Object.keys(plugins)) {
        if (root === path.resolve(plugins[name].root)) {
          delete plugins[name]
          deleted = name
        }
      }
    }
    if (!deleted) return false
    await this.manifest.set('plugins', plugins)
    await this.manifest.save()
    await deps.file.remove(path.join(this.config.dataDir, 'plugins', 'link', `${deleted}.json`))
    delete this.plugins
    return true
  }

  public async findByRoot(root: string): Promise<LinkPlugin | undefined> {
    await this.init()
    root = path.resolve(root)
    return this.plugins && this.plugins.find(p => path.resolve(p.root) === root)
  }

  public async submanagers() {
    await this.init()
    return this.plugins
  }

  public async init(): Promise<void> {
    await this.migrate()
    if (!this.plugins && (await this.hasPlugins())) await this._init()
  }

  private async hasPlugins(): Promise<boolean> {
    if (await deps.file.exists(this.manifest.file)) return true
    this.debug('no link plugins')
    return false
  }

  private async _init(): Promise<void> {
    if (this.plugins) return
    this.debug('init')
    const manifest = await this.manifestPlugins()
    this.plugins = _.compact(
      await Promise.all(
        deps.util.objEntries(manifest).map(async ([k, v]) => {
          let plugin = await this.loadPlugin(v.root).catch(err => {
            cli.warn(err)
            return null
          })
          if (plugin && plugin.name !== k) {
            delete manifest[k]
            manifest[plugin.name] = v
            await this.manifest.set('plugins', manifest)
            await this.manifest.save()
          }
          return plugin
        }),
      ),
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
    await plugin.load()
    let plugins = await this.manifestPlugins()
    plugins[plugin.name] = { root }
    await this.manifest.set('plugins', plugins)
    await this.manifest.save()
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
    deps.validate.pluginPjson(this.pjson, pjsonPath(this.root))
  }

  @rwlockfile('lock', 'write')
  public async reset() {
    await super.reset(true)
    await this.manifest.set('lastUpdated', new Date().toISOString())
    await this.manifest.save()
  }

  private async updateNodeModulesNeeded(): Promise<boolean> {
    // if ((await this.yarnNodeVersion()) !== process.version) return true
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
    await this.prepare()
    touch(path.join(this.root, 'node_modules'))
    await this.reset()
  }

  @rwlockfile('lock', 'write')
  private async prepare() {
    if (!cli.action.running) {
      cli.action.start(`Refreshing linked plugin ${this.name}`, 'yarn run prepare')
    }
    const { scripts } = this.pjson
    const yarn = new deps.Yarn({ config: this.config, cwd: this.root })
    if (scripts && scripts.prepare) await yarn.exec(['run', 'prepare'])
    if (scripts && scripts.prepublishOnly) await yarn.exec(['run', 'prepublishOnly'])
    await this.reset()
  }

  private async lastUpdated(): Promise<Date> {
    const lastUpdated = await this.manifest.get('lastUpdated')
    return lastUpdated ? new Date(lastUpdated) : new Date(0)
  }
}
