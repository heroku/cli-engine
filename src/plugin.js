import Command, {Config, Topic} from 'cli-engine-command'
import type Output from 'cli-engine-command/lib/output'
import Plugins, {
  type Cache,
  type CachedPlugin,
  type ParsedPlugin,
  type CachedCommand,
  type CachedTopic,
  type ParsedCommand,
  type ParsedTopic
} from './plugins'
import path from 'path'
import {convertFromV5, convertFlagsFromV5} from './legacy'

type PluginType = | "builtin" | "core" | "user" | "link"

function undefaultTopic (t: (ParsedTopic | {default: ParsedTopic})): ParsedTopic {
  if (t.default) return (t.default: any)
  return t
}

function undefaultCommand (c: (ParsedCommand | {default: ParsedCommand})): ParsedCommand {
  if (c.default && typeof c.default !== 'boolean') return (c.default: any)
  return (c: any)
}

export default class Plugin {
  constructor (type: PluginType, path: string, plugins: Plugins) {
    this.config = plugins.config
    this.out = plugins.out
    this.cache = plugins.cache
    this.type = type
    this.path = path
    let p = this.fetch()
    this.name = p.name
    this.version = p.version
  }

  config: Config
  type: PluginType
  path: string
  cache: Cache
  name: string
  version: string
  out: Output

  get commands (): CachedCommand[] {
    return this.fetch().commands
  }

  get topics (): CachedTopic[] {
    return this.fetch().topics
  }

  findCommand (cmd: string): ?Class<Command<*>> {
    let c = this.commands.find(c => c.id === cmd || (c.aliases || []).includes(cmd))
    if (!c) return
    let {topic, command} = c
    let p = this.require()
    let Command = (p.commands || [])
      .map(undefaultCommand)
      .find(d => topic === d.topic && command === d.command)
    if (!Command) return
    return typeof Command === 'function' ? Command : convertFromV5((Command: any))
  }

  findTopic (name: string): ?Class<Topic> {
    let t = this.topics.find(t => t.topic === name)
    if (!t) return
    let Topic = (this.require().topics || [])
      .find(t => [t.topic, t.name].includes(name))
    if (!Topic) return
    return typeof Topic === 'function' ? Topic : this.buildTopic(t)
  }

  buildTopic (t: CachedTopic): Class<Topic> {
    return class extends Topic {
      static topic = t.topic
      static description = t.description
      static hidden = t.hidden
    }
  }

  fetch (): CachedPlugin {
    let c = this.cache.plugin(this.path)
    if (c) return c
    try {
      this.out.debug('updating cache for ' + this.path)
      return this.updatePlugin(this.require())
    } catch (err) {
      if (this.type === 'builtin') throw err
      this.out.warn(err)
      return {
        name: this.path,
        path: this.path,
        version: '',
        commands: [],
        topics: []
      }
    }
  }

  updatePlugin (plugin: ParsedPlugin): CachedPlugin {
    const name = this.type === 'builtin' ? 'builtin' : this.pjson().name
    const version = this.type === 'builtin' ? this.config.version : this.pjson().version
    if (!plugin.commands) throw new Error('no commands found')
    const commands: CachedCommand[] = plugin.commands
    .map(undefaultCommand)
    .map(c => ({
      id: c.command ? `${c.topic}:${c.command}` : c.topic,
      topic: c.topic,
      command: c.command,
      description: c.description,
      args: c.args,
      variableArgs: c.variableArgs,
      help: c.help,
      usage: c.usage,
      hidden: !!c.hidden,
      aliases: c.aliases,
      flags: convertFlagsFromV5(c.flags)
    }))
    const topics: CachedTopic[] = (plugin.topics || (plugin.topic ? [plugin.topic] : []))
    .map(undefaultTopic)
    .map(t => ({
      topic: t.topic || t.name || '',
      description: t.description,
      hidden: !!t.hidden
    }))

    for (let command of commands) {
      if (topics.find(t => t.topic === command.topic)) continue
      topics.push({
        topic: command.topic,
        hidden: true
      })
    }

    const cachedPlugin: CachedPlugin = {name, path: this.path, version, commands, topics}
    this.cache.updatePlugin(this.path, cachedPlugin)
    return cachedPlugin
  }

  // flow$ignore
  require (): ParsedPlugin { return require(this.path) }
  // flow$ignore
  pjson (): {name: string, version: string} { return require(path.join(this.path, 'package.json')) }
}
