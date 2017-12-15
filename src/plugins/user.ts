import cli from 'cli-ux'
import { Config } from 'cli-engine-config'
import { Plugin } from './plugin'
import Yarn from './yarn'
import * as path from 'path'
import * as fs from 'fs-extra'
import { PluginManager } from './manager'

export class UserPlugins extends PluginManager {
  public plugins: Plugin[]
  protected config: Config

  private pjsonPath: string
  private yarn: Yarn

  protected async _init() {
    this.pjsonPath = path.join(this.userPluginsDir, 'package.json')
    await this.createPJSON()
    this.yarn = new Yarn({ config: this.config, cwd: this.userPluginsDir })
    if (this.manifest.nodeVersionChanged) await this.yarn.exec()
    this.submanagers = this.plugins = await this.fetchPlugins()
  }

  // public async update() {
  //   if (this.plugins.length === 0) return
  //   cli.action.start(`${this.config.name}: Updating plugins`)
  //   let downgrade = await this.lock.upgrade()
  //   await this.yarn.exec(['upgrade'])
  //   await downgrade()
  // }

  public async install(name: string, tag: string): Promise<void> {
    let downgrade = await this.lock.upgrade()
    await this.yarn.exec(['add', `${name}@${tag}`])
    const plugin = this.loadPlugin(name, tag)
    await plugin.validate()
    await this.manifest.add({ type: 'user', name, tag })
    await downgrade()
  }

  public async uninstall(name: string): Promise<void> {
    let downgrade = await this.lock.upgrade()
    await this.yarn.exec(['remove', name])
    await this.manifest.remove(name)
    await downgrade()
  }

  protected async fetchPlugins() {
    const retVal = []
    const plugins = await this.manifest.list('user')
    for (let p of plugins) {
      try {
        retVal.push(await this.loadPlugin(p.name, p.tag))
      } catch (err) {
        cli.warn(err, { context: `error loading user plugin ${p.name}` })
      }
    }
    return retVal
  }

  private loadPlugin(name: string, tag: string) {
    return new Plugin({
      config: this.config,
      type: 'user',
      root: this.userPluginPath(name),
      tag,
    })
  }

  private userPluginPath(name: string): string {
    return path.join(this.userPluginsDir, 'node_modules', name)
  }

  private async createPJSON() {
    // @ts-ignore
    if (!fs.exists(this.pjsonPath)) {
      await fs.outputJSON(this.pjsonPath, { private: true }, { spaces: 2 })
    }
  }
}
