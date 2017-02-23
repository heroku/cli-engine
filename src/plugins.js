// @flow
/* globals
   Class
*/

import Command, {Config, Base, Topic, type Flag, type Arg} from 'cli-engine-command'
import path from 'path'

type PluginType = | "builtin" | "core"

type CachedCommand = {
  id: string,
  topic: string,
  command?: string,
  aliases: string[],
  args: Arg[],
  flags: Flag[],
  description?: string,
  help?: string,
  usage?: string,
  hidden: boolean,
}

type CachedTopic = {
  topic: string,
  description?: string,
  hidden: boolean,
}

type CachedPlugin = {
  name: string,
  version: string,
  commands: CachedCommand[],
  topics: CachedTopic[]
}

type CacheData = {
  version: string,
  plugins: {[path: string]: CachedPlugin}
}

class Cache extends Base {
  static updated = false
  _cache: CacheData

  get file (): string { return path.join(this.config.dirs.cache, 'plugins.json') }
  get cache (): CacheData {
    if (this._cache) return this._cache
    let initial = {version: this.config.version, plugins: {}}
    try {
      this._cache = this.fs.readJSONSync(this.file)
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
      this._cache = initial
    }
    if (this._cache.version !== this.config.version) this._cache = initial
    return this._cache
  }

  plugin (path: string): ?CachedPlugin { return this.cache.plugins[path] }
  updatePlugin (path: string, plugin: CachedPlugin) {
    this.constructor.updated = true
    this.cache.plugins[path] = plugin
  }

  save () {
    if (!this.constructor.updated) return
    try {
      this.fs.writeJSONSync(this.file, this.cache)
    } catch (err) {
      this.warn(err)
    }
  }
}

const undefault = c => c.default && c.default !== true ? c.default : c

export class Plugin extends Base {
  constructor (type: PluginType, path: string, config: Config, cache: Cache) {
    super(config)
    this.cache = cache
    this.type = type
    this.path = path
    let p = this.fetch()
    this.name = p.name
    this.version = p.version
    this.commands = p.commands
    this.topics = p.topics
  }

  type: PluginType
  path: string
  cache: Cache
  name: string
  version: string
  commands: CachedCommand[]
  topics: CachedTopic[]

  findCommand (cmd: string): ?Class<Command> {
    let c = this.commands.find(c => c.id === cmd || c.aliases.includes(cmd))
    if (!c) return
    let {topic, command} = c
    return this.require()
      .commands
      .map(undefault)
      .find(d => topic === d.topic && command === d.command)
  }

  findTopic (name: string): ?Class<Topic> {
    let t = this.topics.find(t => t.topic === name)
    if (!t) return
    let Topic = this.require()
      .topics
      .find(t => [t.topic, t.name].includes(name))
    if (typeof Topic === 'function') return Topic
    return this.buildTopic(t)
  }

  buildTopic (t: CachedTopic): Class<Topic> {
    return class extends Topic {
      static topic = t.topic
      static descrition = t.description
      static hidden = t.hidden
    }
  }

  fetch (): CachedPlugin {
    let c = this.cache.plugin(this.path)
    if (c) return c
    try {
      return this.updatePlugin(this.require())
    } catch (err) {
      if (this.type === 'builtin') throw err
      this.warn(err)
      return {
        name: this.path,
        version: '',
        commands: [],
        topics: []
      }
    }
  }

  updatePlugin (m: any): CachedPlugin {
    const name = this.type === 'builtin' ? 'builtin' : this.pjson().name
    const version = this.type === 'builtin' ? this.config.version : this.pjson().version
    const commands = m.commands
    .map(undefault)
    .map(c => ({
      id: c.command ? `${c.topic}:${c.command}` : c.topic,
      topic: c.topic,
      command: c.command,
      description: c.description,
      args: c.args,
      flags: c.flags,
      help: c.help,
      usage: c.usage,
      hidden: c.hidden,
      aliases: c.aliases
    }))
    const topics = (m.topics || (m.topic ? [m.topic] : []))
    .map(t => ({
      topic: t.topic || t.name,
      description: t.description,
      hidden: t.hidden || false
    }))

    for (let command of commands) {
      if (topics.find(t => t.topic === command.topic)) continue
      topics.push({
        topic: command.topic,
        hidden: true
      })
    }

    const plugin = {name, version, commands, topics}
    this.cache.updatePlugin(this.path, plugin)
    return plugin
  }

  // flow$ignore
  require (): any { return require(this.path) }
  // flow$ignore
  pjson (): {name: string, version: string} { return require(path.join(this.path, 'package.json')) }
}

export default class Plugins extends Base {
  constructor (config: Config) {
    super(config)
    this.config = config
    this.cache = new Cache(config)
    this.plugins = [new Plugin('builtin', './commands', config, this.cache)]
    this.cache.save()
  }

  plugins: Plugin[]
  cache: Cache

  list () {
    return this.plugins
  }

  findCommand (cmd: string): ?Class<Command> {
    for (let plugin of this.plugins) {
      let c = plugin.findCommand(cmd)
      if (c) return c
    }
  }

  commandsForTopic (topic: string): Class<Command>[] {
    return this.plugins.reduce((t, p) => {
      return t.concat(p.commands
        .filter(c => c.topic === topic)
        .map(c => (p.findCommand(c.id): any)))
    }, [])
  }

  findTopic (cmd: string): ?Class<Topic> {
    let name = cmd.split(':')[0]
    for (let plugin of this.plugins) {
      let t = plugin.findTopic(name)
      if (t) return t
    }
  }

  get topics (): CachedTopic[] {
    return this.plugins.reduce((t, p) => t.concat(p.topics), [])
  }

  config: Config
}
