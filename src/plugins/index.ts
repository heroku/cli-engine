import { Config } from '@cli-engine/config'
import cli from 'cli-ux'
import * as path from 'path'
import _ from 'ts-lodash'

import deps from '../deps'

import { Builtin } from './builtin'
import { CorePlugins } from './core'
import { LinkPlugins } from './link'
import { MainPlugin } from './main'
import { Plugin, PluginType } from './plugin'
import { UserPlugins } from './user'

export type InstallOptions = ILinkInstallOptions | IUserInstallOptions
export interface IUserInstallOptions {
  type: 'user'
  name: string
  tag: string
  force?: boolean
}
export interface ILinkInstallOptions {
  type: 'link'
  root: string
  force?: boolean
}

export class Plugins {
  public builtin: Builtin
  public main: MainPlugin
  public core: CorePlugins
  public user: UserPlugins
  public link: LinkPlugins
  protected debug = require('debug')('cli:plugins')
  private plugins: Plugin[]

  constructor(private config: Config) {
    this.builtin = new Builtin(this.config)
    if (config.commandsDir) {
      this.main = new MainPlugin(this.config)
    }
    if (config.corePlugins) {
      this.core = new CorePlugins(this.config)
    }
    if (config.userPluginsEnabled) {
      this.user = new UserPlugins(this.config)
      this.link = new LinkPlugins(this.config)
    }
  }

  public async submanagers() {
    return _.compact([this.link, this.user, this.core, this.main, this.builtin])
  }

  public async install(options: InstallOptions) {
    await this.init()
    let name = options.type === 'user' ? options.name : await this.getLinkedPackageName(options.root)
    let currentType = await this.pluginType(name)
    if (currentType) {
      if (!options.force) {
        throw new Error(`${name} is already installed, run with --force to install anyway`)
      } else if (['link', 'user'].includes(currentType)) {
        await this.uninstall(name)
      }
    }
    if (options.type === 'link') {
      await this.link.install(options.root)
    } else {
      await this.user.install(name, options.tag)
    }
  }

  public async update(): Promise<void> {
    await this.user.update()
  }

  public async uninstall(name: string): Promise<void> {
    const type = await this.pluginType(name)
    if (!type) {
      const linked = await this.link.findByRoot(name)
      if (linked) {
        name = linked.name
      } else throw new Error(`${name} is not installed`)
    }
    cli.action.start(`Uninstalling ${name}`)
    if (type === 'user') await this.user.uninstall(name)
    cli.action.stop()
  }

  public async list() {
    await this.init()
    return this.plugins
  }

  private async init() {
    if (this.plugins) return
    const managers = _.compact([this.link, this.user, this.core])
    await Promise.all(managers.map(m => m.init()))
    const plugins = managers.reduce((o, i) => o.concat(i.plugins), [] as Plugin[])
    this.plugins = _.compact([...plugins, this.builtin])
    await await this.plugins.map(p => p.load())
  }

  private async getLinkedPackageName(root: string): Promise<string> {
    const pjson = await deps.file.fetchJSONFile(path.join(root, 'package.json'))
    return pjson.name
  }

  private pluginType(name: string): PluginType | undefined {
    const plugin = this.plugins.find(p => p.name === name)
    return plugin && plugin.type
  }
}
