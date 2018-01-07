import * as path from 'path'

import { ILoadResult } from '../command'
import Config from '../config'
import deps from '../deps'

import { Plugin } from './plugin'

interface TSConfig {
  compilerOptions: {
    rootDir?: string
    outDir?: string
  }
}

export class MainPlugin extends Plugin {
  protected skipCache: boolean
  private tsconfig?: TSConfig
  private _commandsDir: string

  constructor(config: Config) {
    const root = config.root!
    const pjson = require(`${root}/package.json`)
    super({ config, type: 'main', root, pjson })
  }

  public async load(): Promise<ILoadResult> {
    if (this.result) return this.result
    this.tsconfig = await this.fetchTSConfig()
    this._commandsDir = this.config.commandsDir!
    if (this.tsconfig) {
      this.debug('tsconfig.json found, skipping cache for main commands')
      this.skipCache = true
      let { rootDir, outDir } = this.tsconfig.compilerOptions
      if (rootDir && outDir) {
        try {
          this.debug('using ts files for main commands')
          require('ts-node/register')
          const lib = path.join(this.config.root!, outDir)
          const src = path.join(this.config.root!, rootDir)
          const relative = path.relative(lib, this.config.commandsDir!)
          this._commandsDir = path.join(src, relative)
        } catch (err) {
          this.debug(err)
        }
      }
    }
    return super.load()
  }

  protected get commandsDir() {
    return this._commandsDir
  }

  private async fetchTSConfig(): Promise<TSConfig | undefined> {
    try {
      const tsconfig = await deps.file.readJSON(path.join(this.root, 'tsconfig.json'))
      return tsconfig.compilerOptions && tsconfig
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }
  }
}
