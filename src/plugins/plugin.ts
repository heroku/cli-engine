import deps from '../deps'
import { PluginManager } from './manager'
import { ICommand, Config } from 'cli-engine-config'
import * as path from 'path'
import { Lock } from '../lock'
import { PluginCache } from './cache'

export type PluginType = 'core' | 'user' | 'link'
export type PluginOptions = {
  config: Config
  cache: PluginCache
  root: string
  lock?: Lock
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

export abstract class Plugin extends PluginManager {
  public name: string
  public version: string
  public abstract type: PluginType
  public root: string
  public pjson: PluginPJSON
  public module?: PluginModule
  public commandsDir?: string
  public tag?: string

  // @ts-ignore
  private lock?: Lock
  private cache: PluginCache

  constructor(options: PluginOptions) {
    super(options)
    this.cache = options.cache
    this.root = options.root
    this.lock = options.lock
  }

  public validate() {
    if (!this.commandIDs.length) {
      throw new Error(`${this.name} does not appear to be a ${this.config.bin} CLI plugin`)
    }
  }

  protected async _init() {
    this.debug('_init')
    await this.cache.init()
    this.pjson = await deps.file.fetchJSONFile(path.join(this.root, 'package.json'))
    const pjsonConfig = this.pjson['cli-engine'] || {}
    this.name = this.pjson.name
    this.version = this.pjson.version
    this.aliases = deps.util.objValsToArrays(pjsonConfig.aliases)

    if (pjsonConfig.commandsDir) {
      this.commandsDir = path.join(this.root, pjsonConfig.commandsDir)
      await this.loadCommandsFromDir(this.commandsDir)
    }

    if (this.pjson.main) {
      const ids = await this.fetchCommandIDsFromModule()
      this.commandIDs.concat(ids)
      // await this.requireModule(this.pjson.main)
    }
  }

  protected _findCommand(id: string): ICommand | undefined {
    let cmd
    if (this.module) {
      cmd = this.module.commands.find(c => c.id === id)
    }
    if (!cmd && this.commandsDir) {
      try {
        cmd = require(this.commandPath(id))
      } catch (err) {
        if (err.code !== 'MODULE_NOT_FOUND') throw err
      }
    }
    if (cmd) {
      cmd = deps.util.undefault(cmd)
      cmd = this.addPluginToCommand(cmd)
      this.debug(`found command ${cmd.id}`)
      // TODO: lock
      // if (this.lock) await this.lock.read()
      return cmd
    }
  }

  protected get debug() {
    return require('debug')(`cli:plugins:${this.name || path.basename(this.root)}`)
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

  private async fetchModule(): Promise<PluginModule> {
    if (this.module) return this.module
    this.debug(`requiring ${this.name}@${this.version}`)

    const m: PluginModule = {
      commands: [],
      topics: [],
      ...require(path.join(this.root, this.pjson.main!)),
    }

    if (m.topic) m.topics.push(m.topic)
    m.commands = m.commands.map(deps.util.undefault)

    const hooks = new deps.Hooks(this.config)
    await hooks.run('plugins:parse', { module: m, pjson: this.pjson })

    for (let topic of m.topics) {
      this.topics[topic.name] = { ...topic, commands: [] }
    }

    return (this.module = m)
  }

  private async fetchCommandIDsFromModule(): Promise<string[]> {
    return this.cache.fetch(this, 'commandIDs', async () => {
      const m = await this.fetchModule()
      return m.commands.map(m => m.id)
    })
  }
}
