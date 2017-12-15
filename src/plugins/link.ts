import { cli } from 'cli-ux'
import { Plugin, PluginPJSON } from './plugin'
import * as path from 'path'
import * as fs from 'fs-extra'
import { PluginManager } from './base'
import * as klaw from 'klaw-sync'
import _ from 'ts-lodash'
import deps from '../deps'

function touch(f: string) {
  fs.utimesSync(f, new Date(), new Date())
}

export class LinkPlugins extends PluginManager {
  public async pjson(root: string): Promise<PluginPJSON> {
    return this.fetchJSONFile(path.join(root, 'package.json'))
  }

  public async install(root: string): Promise<void> {
    const downgrade = await this.lock.upgrade()
    const plugin = await this.loadPlugin(root, true)
    await plugin.validate()
    await this.repo.add({ type: 'link', name: plugin.name, root, lastUpdated: new Date().toString() })
    await downgrade()
  }

  protected async _init() {
    this.submanagers = this.plugins = await this.fetchPlugins()
  }

  protected async fetchPlugins() {
    const defs = await this.repo.list('link')
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
    await this.refreshPlugin(root, forceRefresh || this.repo.nodeVersionChanged)
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
    if (!main) return false
    // @ts-ignore
    if (!await fs.exists(path.join(root, main))) return true
    const updatedAt = this.lastUpdatedForRoot(root)
    return !!klaw(root, {
      // @ts-ignore
      noRecurseOnFailedFilter: true,
      filter: (f: any) => !['.git', 'node_modules'].includes(path.basename(f.path)),
    })
      // TODO: it might be good to remove .js to get rid of false positives once people are mostly off flow builds
      .filter((f: any) => f.path.endsWith('.js') || f.path.endsWith('.ts'))
      .find((f: any) => f.stats.mtime > updatedAt)
  }

  private async prepare(root: string) {
    cli.action.start(`Running prepare script for ${root}`)
    const yarn = new deps.Yarn({ config: this.config, cwd: root })
    await yarn.exec(['run', 'prepare'])
    cli.action.stop()
  }

  private async lastUpdatedForRoot(root: string): Promise<Date | undefined> {
    const p = await this.repo.list('link')
    const plugin = p.find(p => p.root === root)
    if (plugin) return new Date(plugin.lastUpdated)
  }
}
