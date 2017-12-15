import { Config } from 'cli-engine-config'
import { Plugin, PluginPJSON } from './plugin'
import { Lock } from '../lock'
import { PluginRepo } from './repo'
import { CommandManagerBase } from '../command_managers/base'
import * as path from 'path'
import * as fs from 'fs-extra'

export type PluginManagerOptions = {
  config: Config
  repo: PluginRepo
}

export abstract class PluginBase extends CommandManagerBase {
  protected static jsons: { [k: string]: any } = {}
  protected userPluginsDir: string
  private get ctor(): typeof PluginBase {
    return this.constructor as typeof PluginBase
  }

  public async fetchJSONFile(f: string): Promise<PluginPJSON> {
    if (!this.ctor.jsons[f]) {
      this.ctor.jsons[f] = await fs.readJSON(path.join(f))
    }
    return this.ctor.jsons[f]
  }
}

export abstract class PluginManager extends PluginBase {
  constructor(opts: PluginManagerOptions) {
    super(opts.config)
    this.repo = opts.repo
    this.userPluginsDir = path.join(this.config.dataDir, 'plugins')
  }

  public plugins: Plugin[]

  protected repo: PluginRepo
  protected lock: Lock
}
