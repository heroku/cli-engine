import deps from '../deps'
import { PluginManager } from './manager'
import { ICommand, Config } from 'cli-engine-config'
import * as path from 'path'

const debug = require('debug')('plugins:plugin')

export type PluginType = 'core' | 'user' | 'link'
export type PluginOptions = {
  type: PluginType
  root: string
  tag?: string
  config: Config
}

export type PluginPJSON = {
  name: string
  version: string
  main?: string
}

export type PluginTopic = {
  name: string
  description?: string
  hidden?: boolean
}

export type PluginModule = {
  commands: ICommand[]
  topics: PluginTopic[]
}

export class Plugin extends PluginManager {
  public name: string
  public version: string
  public type: PluginType
  public root: string
  public pjson: PluginPJSON
  public tag?: string
  public module?: PluginModule

  constructor(options: PluginOptions) {
    super(options)
    this.type = options.type
    this.root = options.root
    this.tag = options.tag
  }

  public validate() {
    if (!this.commandIDs.length) {
      throw new Error(`${this.name} does not appear to be a ${this.config.bin} CLI plugin`)
    }
  }

  protected async _init() {
    this.pjson = await deps.util.fetchJSONFile(path.join(this.root, 'package.json'))
    this.name = this.pjson.name
    this.version = this.pjson.version

    if (this.pjson.main) {
      this.module = await this.requireModule(this.pjson.main)

      for (let topic of this.module.topics) {
        this.topics[topic.name] = { ...topic, commands: [] }
      }
      this.commandIDs = [...this.commandIDs, ...this.module.commands.map(m => m.id)]
    }
  }

  protected _findCommand(id: string): ICommand | undefined {
    if (this.module) {
      let cmd = this.module.commands.find(c => c.id === id)
      if (cmd) return this.addPluginToCommand(cmd)
    }
  }

  private addPluginToCommand(cmd: ICommand): ICommand {
    cmd.plugin = {
      type: this.type,
      path: this.root,
      name: this.name,
      version: this.version,
    }
    return cmd
  }

  private async requireModule(main: string): Promise<PluginModule> {
    debug(`requiring ${this.name}@${this.version}`)

    const m = {
      commands: [],
      topics: [],
      ...require(path.join(this.root, main)),
    }

    if (m.topic) m.topics.push(m.topic)
    m.commands = m.commands.map(deps.util.undefault)

    const hooks = new deps.Hooks(this.config)
    await hooks.run('plugins:parse', { module: m, pjson: this.pjson })

    return m
  }
}
