import { cli } from 'cli-ux'
import { Plugin, PluginPJSON } from './plugin'
import * as path from 'path'
import * as fs from 'fs-extra'
import { PluginManager } from './manager'
import _ from 'ts-lodash'
import deps from '../deps'

const debug = require('debug')('cli:plugins:link')

function touch(f: string) {
  fs.utimesSync(f, new Date(), new Date())
}

export class LinkPlugins extends PluginManager {
  public plugins: Plugin[]

  public async pjson(root: string): Promise<PluginPJSON> {
    return deps.util.fetchJSONFile(path.join(root, 'package.json'))
  }

  public async install(root: string): Promise<void> {
    const downgrade = await this.lock.upgrade()
    const plugin = await this.loadPlugin(root, true)
    await plugin.init()
    await plugin.validate()
    await this.manifest.add({ type: 'link', name: plugin.name, root, last_updated: new Date().toISOString() })
    await this.manifest.save()
    await downgrade()
  }

  protected async _init() {
    this.submanagers = this.plugins = await this.fetchPlugins()
  }

  protected async fetchPlugins(): Promise<Plugin[]> {
    const defs = this.manifest.list('link')
    const promises = defs.map(async p => {
      try {
        return await this.loadPlugin(p.root)
      } catch (err) {
        cli.warn(err, { context: `error loading linked plugin from ${p.root}` })
      }
    })
    const plugins = await Promise.all(promises)
    return _.compact(plugins)
  }

  private async loadPlugin(root: string, forceRefresh: boolean = false) {
    await this.refreshPlugin(root, forceRefresh || this.manifest.nodeVersionChanged)
    return new Plugin({
      config: this.config,
      type: 'link',
      root,
    })
  }

  private async refreshPlugin(root: string, refresh: boolean = false) {
    if (refresh || (await this.updateNodeModulesNeeded(root))) {
      await this.updateNodeModules(root)
      await this.prepare(root)
    } else if (await this.prepareNeeded(root)) {
      await this.prepare(root)
    }
  }

  private async updateNodeModulesNeeded(root: string): Promise<boolean> {
    let modules = path.join(root, 'node_modules')
    // @ts-ignore
    if (!await fs.exists(modules)) return true
    let modulesInfo = await fs.stat(modules)
    let pjsonInfo = await fs.stat(path.join(root, 'package.json'))
    return modulesInfo.mtime < pjsonInfo.mtime
  }

  private async updateNodeModules(root: string): Promise<void> {
    cli.action.start(`Installing node modules for ${root}`)
    const yarn = new deps.Yarn({ config: this.config, cwd: root })
    await yarn.exec()
    touch(path.join(root, 'node_modules'))
    cli.action.stop()
  }

  private async prepareNeeded(root: string): Promise<boolean> {
    const pjson = await this.pjson(root)
    const main = pjson.main
    // @ts-ignore
    if (main && !await fs.exists(path.join(root, main))) return true
    return this.dirty(root)
  }

  private async dirty(root: string): Promise<boolean> {
    const updatedAt = await this.lastUpdatedForRoot(root)
    if (!updatedAt) return true
    return new Promise<boolean>((resolve, reject) => {
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
            if (f.stats.mtime > updatedAt) {
              debug(`${f.path} has been updated, preparing linked plugin`)
              resolve(true)
            }
          }
        })
        .on('error', reject)
        .on('end', () => resolve(false))
    })
  }

  private async prepare(root: string) {
    cli.action.start(`Running prepare script for ${root}`)
    const yarn = new deps.Yarn({ config: this.config, cwd: root })
    await yarn.exec(['run', 'prepare'])
    const plugins = this.manifest.list('link')
    if (plugins.find(p => p.root === root)) {
      this.manifest.update(root)
    }
    cli.action.stop()
  }

  private lastUpdatedForRoot(root: string): Date | undefined {
    const p = this.manifest.list('link')
    const plugin = p.find(p => p.root === root)
    if (plugin) return new Date(plugin.last_updated)
  }
}
