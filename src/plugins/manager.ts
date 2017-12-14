import { Config } from 'cli-engine-config'
import { Plugin } from './plugin'
import { Lock } from '../lock'
import { PluginRepo } from './repo'
import { CommandManagerBase } from '../command_managers/base'

export abstract class PluginManager extends CommandManagerBase {
  public refreshNeeded = false
  protected plugins: Plugin[]
  protected lock: Lock
  protected repo: PluginRepo

  constructor({ config, repo }: { config: Config; repo: PluginRepo }) {
    super(config)
    this.lock = new Lock(this.config)
    this.repo = repo
  }

  public async list(): Promise<Plugin[]> {
    await this.init()
    return this.plugins
  }

  public get submanagers() {
    return this.plugins
  }

  public async init() {
    if (this.plugins) return
    this.plugins = await this.fetchPlugins()
    await super.init()
  }

  protected abstract fetchPlugins(): Promise<Plugin[]>
}
