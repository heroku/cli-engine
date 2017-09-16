import { Config } from 'cli-engine-config'
import { CLI } from 'cli-ux'
import { Plugin } from './plugin'
import { Lock } from '../lock'
import Yarn from './yarn'
import * as path from 'path'
import * as fs from 'fs-extra'

export type PJSON = {
  private?: true
  dependencies?: { [name: string]: string }
}

export class UserPlugins {
  public plugins: Plugin[]
  protected config: Config
  protected cli: CLI
  protected userPluginsPJSONPath: string
  protected userPluginsPJSON: PJSON = { private: true }
  private lock: Lock
  private yarn: Yarn

  constructor({ config, cli }: { config: Config; cli: CLI }) {
    this.config = config
    this.cli = cli
    this.lock = new Lock(this.config, this.cli)
    this.yarn = new Yarn({ config, cli, cwd: this.userPluginsDir })
  }

  get userPluginsDir(): string {
    return path.join(this.config.dataDir, 'plugins')
  }

  public async update() {
    await this.init()
    if (this.plugins.length === 0) return
    this.cli.action.start(`${this.config.name}: Updating plugins`)
    let downgrade = await this.lock.upgrade()
    await this.yarn.exec(['upgrade'])
    await downgrade()
  }

  public async list(): Promise<Plugin[]> {
    await this.init()
    return this.plugins
  }

  public async install(name: string, tag: string): Promise<void> {
    await this.init()
    this.addPackageToPJSON(name, tag)
    try {
      await this.yarn.exec()
      let path = this.userPluginPath(name)
      let plugin = require(path)
      if (!plugin.commands) throw new Error(`${name} does not appear to be a ${this.config.bin} CLI plugin`)
      this.plugins.push(plugin)
    } catch (err) {
      this.removePackageFromPJSON(name)
      this.cli.error(err)
    }
  }

  userPluginPath(name: string): string {
    return path.join(this.userPluginsDir, 'node_modules', name)
  }

  public async init() {
    await this.setupUserPlugins()
    if (this.plugins) return
    const pjson = this.userPluginsPJSON
    this.plugins = Object.entries(pjson.dependencies || {}).map(([name, tag]) => {
      return new Plugin({
        config: this.config,
        cli: this.cli,
        type: 'user',
        root: this.userPluginPath(name),
        tag: tag,
      })
    })
  }

  protected async setupUserPlugins() {
    this.userPluginsPJSONPath = path.join(this.userPluginsDir, 'package.json')
    if (!fs.existsSync(this.userPluginsPJSONPath)) {
      this.saveUserPluginsPJSON()
    }
    this.userPluginsPJSON = await fs.readJSON(this.userPluginsPJSONPath)
  }

  protected saveUserPluginsPJSON() {
    fs.outputJSONSync(this.userPluginsPJSONPath, this.userPluginsPJSON, { spaces: 2 })
  }

  protected async addPackageToPJSON(name: string, version: string) {
    let pjson = this.userPluginsPJSON
    if (!pjson.dependencies) pjson.dependencies = {}
    pjson.dependencies[name] = version
    this.saveUserPluginsPJSON()
  }

  protected removePackageFromPJSON(name: string) {
    let pjson = this.userPluginsPJSON
    if (!pjson.dependencies) pjson.dependencies = {}
    delete pjson.dependencies[name]
    this.saveUserPluginsPJSON()
  }
}
