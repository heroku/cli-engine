import deps from '../deps'
import cli from 'cli-ux'
import { Config } from 'cli-engine-config'
import { Plugin } from './plugin'
import Yarn from './yarn'
import * as path from 'path'
import * as fs from 'fs-extra'
import { Lock } from '../lock'
import { PluginManager } from './manager'
import _ from 'ts-lodash'

export class UserPlugins extends PluginManager {
  public plugins: Plugin[]
  protected config: Config
  protected lock: Lock

  private pjsonPath: string
  private yarn: Yarn

  protected async _init() {
    this.lock = new deps.Lock(this.config, path.join(this.userPluginsDir, 'plugins.lock'))
    this.pjsonPath = path.join(this.userPluginsDir, 'package.json')
    await this.createPJSON()
    this.yarn = new Yarn({ config: this.config, cwd: this.userPluginsDir })
    if (this.manifest.nodeVersionChanged) await this.yarn.exec()
    this.submanagers = this.plugins = await this.fetchPlugins()
  }

  public async update() {
    if (this.plugins.length === 0) return
    cli.action.start(`${this.config.name}: Updating plugins`)
    let downgrade = await this.lock.upgrade()
    const packages = this.manifest.list('user').map(p => `${p.name}@${p.tag}`)
    await this.yarn.exec(['upgrade', ...packages])
    await downgrade()
  }

  public async install(name: string, tag: string): Promise<void> {
    let downgrade = await this.lock.upgrade()
    await this.yarn.exec(['add', `${name}@${tag}`])
    const plugin = this.loadPlugin(name, tag)
    await plugin.init()
    await plugin.validate()
    await this.manifest.add({ type: 'user', name, tag })
    await this.manifest.save()
    await downgrade()
  }

  public async uninstall(name: string): Promise<void> {
    await this.yarn.exec(['remove', name])
    await this.manifest.remove(name)
  }

  protected async fetchPlugins() {
    const defs = this.manifest.list('user')
    const promises = defs.map(async p => {
      try {
        return await this.loadPlugin(p.name, p.tag)
      } catch (err) {
        cli.warn(err, { context: `error loading user plugin from ${this.userPluginPath(p.name)}` })
      }
    })
    const plugins = await Promise.all(promises)
    return _.compact(plugins)
  }

  private loadPlugin(name: string, tag: string) {
    return new Plugin({
      config: this.config,
      type: 'user',
      root: this.userPluginPath(name),
      lock: this.lock,
      tag,
    })
  }

  private userPluginPath(name: string): string {
    return path.join(this.userPluginsDir, 'node_modules', name)
  }

  private async createPJSON() {
    if (!await deps.util.exists(this.pjsonPath)) {
      await fs.outputJSON(this.pjsonPath, { private: true }, { spaces: 2 })
    }
  }
}
