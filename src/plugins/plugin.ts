import cli from 'cli-ux'
import deps from '../deps'
import { PluginManager } from './manager'
import { ICommand, Config } from 'cli-engine-config'
import * as path from 'path'

const debug = require('debug')('cli:plugins')

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
  scripts?: { [k: string]: string }
  'cli-engine'?: {
    commandsDir?: string
    aliases?: { [k: string]: string | string[] }
  }
}

export type PluginTopic = {
  name: string
  description?: string
  hidden?: boolean
}

export type PluginModule = {
  commands: ICommand[]
  topic?: PluginTopic
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
  public commandsDir?: string

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
    try {
      this.pjson = await deps.util.fetchJSONFile(path.join(this.root, 'package.json'))
      const pjsonConfig = this.pjson['cli-engine'] || {}
      this.name = this.pjson.name
      this.version = this.pjson.version

      if (pjsonConfig.commandsDir) {
        this.commandsDir = path.join(this.root, pjsonConfig.commandsDir)
        await this.loadCommandsFromDir(this.commandsDir)
      }

      if (this.pjson.main) {
        await this.requireModule(this.pjson.main)
      }

      this.aliases = deps.util.objValsToArrays(pjsonConfig.aliases)
    } catch (err) {
      cli.warn(err, { context: `Error loading plugin: ${this.name}` })
    }
  }

  protected _findCommand(id: string): ICommand | undefined {
    if (this.module) {
      let cmd = this.module.commands.find(c => c.id === id)
      if (cmd) return this.addPluginToCommand(cmd)
    }
    if (this.commandsDir) {
      try {
        let cmd = require(this.commandPath(id))
        return this.addPluginToCommand(deps.util.undefault(cmd))
      } catch (err) {
        if (err.code !== 'MODULE_NOT_FOUND') throw err
      }
    }
  }

  private commandPath(id: string): string {
    if (!this.commandsDir) throw new Error('commandsDir not set')
    return path.join(this.commandsDir, id.split(':').join(path.sep))
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

  private async requireModule(main: string) {
    debug(`requiring ${this.name}@${this.version}`)

    const m: PluginModule = {
      commands: [],
      topics: [],
      ...require(path.join(this.root, main)),
    }

    if (m.topic) m.topics.push(m.topic)
    m.commands = m.commands.map(deps.util.undefault)

    const hooks = new deps.Hooks(this.config)
    await hooks.run('plugins:parse', { module: m, pjson: this.pjson })

    for (let topic of m.topics) {
      this.topics[topic.name] = { ...topic, commands: [] }
    }
    this.commandIDs = [...this.commandIDs, ...m.commands.map(m => m.id)]

    this.module = m
  }
}
