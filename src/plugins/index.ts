import {CLI} from 'cli-ux'
import {CommandManagerBase} from '../command_managers/base'
import {Config} from 'cli-engine-config'
import * as fs from 'fs-extra'
import * as path from 'path'
import _ from 'ts-lodash'

export class Plugins extends CommandManagerBase {
  protected plugins: Plugin[]

  public async listPlugins (): Promise<Plugin[]> {
    await this.init()
    return this.plugins
  }

  protected async init () {
    if (this.plugins) return
    this.plugins = []
    const cli = this.config.pjson['cli-engine']
    if (cli.plugins) {
      let pluginOpts = {cli: this.cli, config: this.config}
      let plugins = cli.plugins.map(p => {
        return new Plugin({
          ...pluginOpts,
          type: 'core',
          root: path.join(this.config.root, 'node_modules', p)
        })
      })
      this.plugins = this.plugins.concat(plugins)
    }
    this.submanagers = this.submanagers.concat(this.plugins)
    await super.init()
  }
}

type PluginTypes = 'core' | 'user' | 'link'
type PluginOptions = {
  type: PluginTypes
  root: string
  tag?: string
  config: Config
  cli: CLI
}

type PluginPJSON = {
  name: string
  version: string
  main?: string
}

type PluginCommand = {
  topic?: string
  command?: string
}

type PluginModule = {
  commands: PluginCommand[]
}

class Plugin extends CommandManagerBase {
  public name: string
  public version: string
  public type: PluginTypes
  public root: string
  public pjson: PluginPJSON
  public tag?: string
  public module?: PluginModule

  constructor (options: PluginOptions) {
    super(options)
    this.type = options.type
    this.root = options.root
    this.tag = options.tag
  }

  public async listCommandIDs (): Promise<string[]> {
    let ids = await super.listCommandIDs()
    if (this.module) {
      ids = ids.concat(this.module.commands.map(c => this.makeID(c)))
    }
    return ids
  }

  protected async init () {
    this.pjson = await fs.readJSON(path.join(this.root, 'package.json'))
    this.name = this.pjson.name
    this.version = this.pjson.version
    if (this.pjson.main) {
      const m = require(path.join(this.root, this.pjson.main))
      if (!m.commands) m.commands = []
      if (!m.topics) m.topics = []
      if (m.topic) m.topics.push(m.topic)
      this.module = m
    }
    await super.init()
  }

  private makeID (c: PluginCommand): string {
    return _.compact([c.topic, c.command]).join(':')
  }
}
