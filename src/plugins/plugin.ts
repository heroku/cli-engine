import {IArg, IFlag} from 'cli-flags'
import {CLI} from 'cli-ux'
import {Command} from 'cli-engine-command'
import {CommandManagerBase} from '../command_managers/base'
import {ICommand, Config, Topic} from 'cli-engine-config'
import * as fs from 'fs-extra'
import * as path from 'path'
import _ from 'ts-lodash'
import * as supportsColor from 'supports-color'

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

export type V5Context = {
  supportsColor: boolean
}

export type V5Flag = {
  name: string,
  description?: string,
  char?: string,
  hasValue?: boolean,
  hidden?: boolean,
  required?: boolean,
  optional?: boolean,
  parse?: any
}

export type V5Command = {
  topic: string,
  command?: string,
  aliases?: string[],
  variableArgs?: boolean,
  args?: IArg[],
  flags?: V5Flag[],
  description?: string,
  help?: string,
  usage?: string,
  needsApp?: boolean,
  needsAuth?: boolean,
  needsOrg?: boolean,
  hidden?: boolean,
  default?: boolean,
  run: (ctx: V5Context) => Promise<void>
}

type FlowCommand = {
  topic?: string
  command?: string
  description?: string
  flags?: {[k: string]: IFlag<any>}
  run: (options: {argv: string[], config: Config}) => Promise<void>
}

type PluginCommand = FlowCommand | V5Command

type PluginTopic = {
  id?: string
  name?: string
  topic?: string
  description?: string
  hidden?: boolean
}

type PluginModule = {
  commands: PluginCommand[]
  topics: PluginTopic[]
}

function fixTopic (t: PluginTopic): Topic | undefined {
  if (!t) return
  let name = t.name || t.topic || t.id
  if (!name) return
  return {
    name,
    description: t.description,
    hidden: t.hidden,
  }
}

function isV5Command (c: PluginCommand): c is V5Command {
    return typeof c === 'object'
}

// function isFlowCommand (c: PluginCommand): c is FlowCommand {
//     return typeof c === 'function'
// }

function fixCommand (config: Config, c: PluginCommand, id: string): ICommand {
  let options: ICommand['options'] = {
    description: c.description
  }
  if (isV5Command(c)) {
  } else {
    options = {
      ...options,
      flags: c.flags,
    }
  }
  class CMD extends Command {
    __config = {
      ...super.config,
      id
    }

    options = options

    async run () {
      if (isV5Command(c)) {
        await c.run({
          supportsColor: supportsColor.hasBasic
        })
      } else {
        await c.run({argv: config.argv.slice(3), config})
      }
    }
  }
  return new CMD({
    ...config,
    argv: config.argv.slice(0),
  })
}

export class Plugin extends CommandManagerBase {
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

  public async findCommand (id: string): Promise<ICommand | undefined> {
    let cmd = await super.findCommand(id)
    if (cmd) return cmd
    if (this.module) {
      let cmd = this.module.commands.find(c => this.makeID(c) === id)
      if (cmd) return fixCommand(this.config, cmd, id)
    }
  }

  public async listCommandIDs (): Promise<string[]> {
    let ids = await super.listCommandIDs()
    if (this.module) {
      ids = ids.concat(this.module.commands.map(c => this.makeID(c)))
    }
    return ids
  }

  public async listTopics (): Promise<Topic[]> {
    let topics = await super.listTopics()
    if (this.module) {
      topics = topics.concat(_.compact(this.module.topics.map(fixTopic)))
    }
    return topics
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
      m.commands.map((c: any, i: number) => m.commands[i] = (c.default && typeof c.default !== 'boolean') ? c.default : c)
      this.module = m
    }
    await super.init()
  }

  private makeID (c: PluginCommand): string {
    return _.compact([c.topic, c.command]).join(':')
  }
}
