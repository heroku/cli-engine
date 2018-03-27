import cli from 'cli-ux'
import * as path from 'path'
import RWLockfile, { rwlockfile } from 'rwlockfile'
import _ from 'ts-lodash'

import Config from '../config'
import deps from '../deps'

import { PluginManifest } from './manifest'
import { IPluginOptions, Plugin, PluginType } from './plugin'
import Yarn from './yarn'

export class UserPlugins {
  public plugins: UserPlugin[]
  public yarn: Yarn
  private manifest: PluginManifest
  private lock: RWLockfile
  private debug: any

  constructor(private config: Config) {
    this.debug = require('debug')('cli:plugins:user')
    this.manifest = new deps.PluginManifest({
      name: 'user',
      file: path.join(this.config.dataDir, 'plugins', 'user.json'),
    })
    this.lock = new RWLockfile(this.manifest.file, { ifLocked: () => cli.action.start('Updating user plugins') })
    this.yarn = new Yarn({ config: this.config, cwd: this.userPluginsDir })
  }

  public async submanagers() {
    await this.init()
    return this.plugins
  }

  @rwlockfile('lock', 'write')
  public async update() {
    await this.init()
    if (!this.plugins) return
    cli.action.start(`${this.config.name}: Updating plugins`)
    const packages = deps.util.objEntries(await this.manifestPlugins()).map(([k]) => `${k}@latest`)
    await this.yarn.exec(['add', ...packages])
    await this.refresh(true)
  }

  @rwlockfile('lock', 'write')
  public async install(name: string, tag: string): Promise<void> {
    cli.action.start(`Installing ${name}@${tag}`)
    await this.init()
    await this.addPlugin(name, tag)
    cli.action.stop()
  }

  @rwlockfile('lock', 'write')
  public async uninstall(name: string): Promise<boolean> {
    return await this.removePlugin(name)
  }

  public async refresh(force = false) {
    if (!this.plugins.length) return
    const nodeVersionChanged = (await this.yarnNodeVersion()) !== process.version
    if (!force && !nodeVersionChanged) return
    if (nodeVersionChanged) cli.action.start(`Updating plugins, node version changed to ${process.versions.node}`)
    await this.lock.add('write', { reason: 'refresh' })
    try {
      await this.yarn.exec()
      for (let p of this.plugins.map(p => p.reset())) await p
    } finally {
      await this.lock.remove('write')
    }
  }

  public async init() {
    await this.migrate()
    if (!this.plugins && (await this.hasPlugins())) await this.fetchPlugins()
  }

  private async hasPlugins(): Promise<boolean> {
    if (await deps.file.exists(this.manifest.file)) return true
    this.debug('no user plugins')
    return false
  }

  private async fetchPlugins() {
    this.debug('fetchPlugins')
    this.plugins = _.compact(
      await Promise.all(
        deps.util.objEntries(await this.manifestPlugins()).map(([k, v]) => {
          return this.loadPlugin(k, v.tag).catch(err => {
            if (err.code === 'ENOCOMMANDS') this.debug(err)
            else cli.warn(err)
            return null
          })
        }),
      ),
    )
    if (this.plugins.length) this.debug('plugins:', this.plugins.map(p => p.name).join(', '))
    // skip plugin rebuilding for now
    // await this.refresh()
  }

  private async loadPlugin(name: string, tag: string): Promise<UserPlugin> {
    const pjsonPath = path.join(this.userPluginPath(name), 'package.json')
    if (!await deps.file.exists(pjsonPath)) {
      cli.action.start(`Refreshing user plugins`)
      await this.addPlugin(name, tag)
    }
    const pjson = await deps.file.readJSON(pjsonPath)
    let p = new UserPlugin({
      type: 'user',
      pjson,
      tag,
      root: this.userPluginPath(name),
      config: this.config,
    })
    return p
  }

  private userPluginPath(name: string): string {
    return path.join(this.userPluginsDir, 'node_modules', name)
  }

  private get userPluginsDir() {
    return path.join(this.config.dataDir, 'plugins')
  }
  private get pjsonPath() {
    return path.join(this.userPluginsDir, 'package.json')
  }

  private async createPJSON() {
    if (!await deps.file.exists(this.pjsonPath)) {
      await deps.file.outputJSON(this.pjsonPath, { private: true, 'cli-engine': { schema: 1 } }, { spaces: 2 })
    }
  }

  private async migrate() {
    const userPath = path.join(this.config.dataDir, 'plugins', 'package.json')
    if (!await deps.file.exists(userPath)) return
    await this.lock.add('read', { reason: 'migrate' })
    try {
      let user = await deps.file.readJSON(userPath)
      if (!user.dependencies || user['cli-engine']) return
      await this.lock.add('write', { reason: 'migrate' })
      try {
        cli.action.start('Refreshing plugins')
        await deps.file.remove(path.join(this.config.dataDir, 'plugins/node_modules'))
        await this.createPJSON()
        await this.yarn.exec()
        this.debug('migrating user plugins')
        for (let [name, tag] of deps.util.objEntries<string>(user.dependencies)) {
          await this.addPlugin(name, tag)
        }
        user['cli-engine'] = { schema: 1 }
        await deps.file.outputJSON(userPath, user)
      } finally {
        await this.lock.remove('write')
      }
    } finally {
      await this.lock.remove('read')
    }
  }

  private async addPlugin(name: string, tag: string) {
    try {
      await this.createPJSON()
      await this.yarn.exec(['add', `${name}@${tag}`])
      let plugin = await this.loadPlugin(name, tag)
      await plugin.reset(true)
      let plugins = await this.manifestPlugins()
      plugins[name] = { tag }
      await this.manifest.set('plugins', plugins)
      await this.manifest.save()
    } catch (err) {
      await this.removePlugin(name).catch(err => this.debug(err))
      throw err
    }
  }

  private async removePlugin(name: string): Promise<boolean> {
    let plugins = await this.manifestPlugins()
    if (!plugins[name]) return false
    delete plugins[name]
    await this.manifest.set('plugins', plugins)
    await this.manifest.save()
    await this.yarn.exec(['remove', name])
    return true
  }

  private async manifestPlugins(): Promise<{ [k: string]: { tag: string } }> {
    return (await this.manifest.get('plugins')) || {}
  }

  private async yarnNodeVersion(): Promise<string | undefined> {
    try {
      let f = await deps.file.readJSON(path.join(this.userPluginsDir, 'node_modules', '.yarn-integrity'))
      return f.nodeVersion
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }
  }
}

export type UserPluginOptions = IPluginOptions & {
  tag: string
}

export class UserPlugin extends Plugin {
  public type: PluginType = 'user'
  public tag: string

  constructor(opts: UserPluginOptions) {
    super(opts)
    this.tag = opts.tag || 'latest'
  }
}
