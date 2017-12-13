import { CommandManagerBase } from '../command_managers/base'
import { ICommand, Config, Topic } from 'cli-engine-config'
import * as fs from 'fs-extra'
import * as path from 'path'
import _ from 'ts-lodash'
import { Hooks } from '../hooks'

const debug = require('debug')('plugins:plugin')

export type PluginTypes = 'core' | 'user' | 'link'
export type PluginOptions = {
  type: PluginTypes
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
  id?: string
  name?: string
  topic?: string
  description?: string
  hidden?: boolean
}

export type PluginModule = {
  commands: ICommand[]
  topics: PluginTopic[]
}

function fixTopic(t: PluginTopic): Topic | undefined {
  if (!t) return
  let name = t.name || t.topic || t.id
  if (!name) return
  return {
    name,
    description: t.description,
    hidden: t.hidden,
  }
}

export class Plugin extends CommandManagerBase {
  public name: string
  public version: string
  public type: PluginTypes
  public root: string
  public pjson: PluginPJSON
  public tag?: string
  public module?: PluginModule

  constructor(options: PluginOptions) {
    super(options.config)
    this.type = options.type
    this.root = options.root
    this.tag = options.tag
  }

  public async findCommand(id: string): Promise<ICommand | undefined> {
    let cmd = await super.findCommand(id)
    if (cmd) return cmd
    if (this.module) {
      let cmd = this.module.commands.find(c => c.id === id)
      if (cmd) return cmd
    }
  }

  public async listCommandIDs(): Promise<string[]> {
    let ids = await super.listCommandIDs()
    if (this.module) {
      let mids = this.module.commands.map(c => c.id)
      ids = ids.concat(mids)
    }
    return ids
  }

  public async listTopics(): Promise<Topic[]> {
    let topics = await super.listTopics()
    if (this.module) {
      topics = topics.concat(_.compact(this.module.topics.map(fixTopic)))
    }
    return topics
  }

  protected async init() {
    if (this.pjson) return
    this.pjson = await fs.readJSON(path.join(this.root, 'package.json'))
    this.name = this.pjson.name
    this.version = this.pjson.version
    if (this.pjson.main) {
      debug(`requiring ${this.name}@${this.version}`)
      const m = require(path.join(this.root, this.pjson.main))
      if (!m.commands) m.commands = []
      if (!m.topics) m.topics = []
      if (m.topic) m.topics.push(m.topic)
      m.commands.map(
        (c: any, i: number) => (m.commands[i] = c.default && typeof c.default !== 'boolean' ? c.default : c),
      )
      const hooks = new Hooks(this.config)
      await hooks.run('plugins:parse', { module: m, plugin: this })
      this.module = m
    }
    await super.init()
  }
}
