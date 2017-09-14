import {Config} from 'cli-engine-config'
import {CLI} from 'cli-ux'
import * as fs from 'fs-extra'
import * as path from 'path'

export class Plugins {
  private cli: CLI
  private plugins: Plugin[]

  constructor (readonly config: Config, cli?: CLI) {
    this.cli = cli || new CLI({mock: config.mock, debug: !!config.debug, errlog: config.errlog})
  }

  public async listCommandIDs (): Promise<string[]> {
    await this.load()
    return ['foo']
  }

  private async load () {
    if (this.plugins) return
    this.plugins = []
    const cli = this.config.pjson['cli-engine']
    if (cli.plugins) {
      this.plugins.concat(cli.plugins.map(p => new Plugin({type: 'core', root: path.join(this.config.root, 'node_modules', p)})))
    }
    await Promise.all(this.plugins.map(p => p.load()))
  }
}

type PluginTypes = 'core' | 'user' | 'link'
type PluginOptions = {
  type: PluginTypes
  root: string
}

type PluginPJSON = {
  name: string
  version: string
}

class Plugin {
  public type: PluginTypes
  public root: string
  public pjson: PluginPJSON

  constructor (options: PluginOptions) {
    this.type = options.type
    this.root = options.root
  }

  public async load () {
    this.pjson = await fs.readJSON(path.join(this.root, 'package.json'))
  }
}
