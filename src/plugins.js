// @flow

import Command, {Config, Base, Topic, mixins, type Flag, type Arg} from 'cli-engine-command'
import path from 'path'
import Yarn from './yarn'
import lock from 'rwlockfile'
import LinkedPlugins from './linked_plugins'
import uniqby from 'lodash.uniqby'

type PluginType = | "builtin" | "core" | "user" | "link"

type LegacyContext = {
  supportsColor: boolean
}

type LegacyCommand = {
  topic: string,
  command?: string,
  aliases?: string[],
  variableArgs?: boolean,
  args: Arg[],
  flags: Flag[],
  description?: ?string,
  help?: ?string,
  usage?: ?string,
  needsApp?: ?boolean,
  needsAuth?: ?boolean,
  hidden?: ?boolean,
  default?: ?boolean,
  run: (ctx: LegacyContext) => Promise<any>
}

type ParsedTopic = | {
  name?: ?string,
  topic?: ?string,
  description?: ?string,
  hidden?: ?boolean
} | Class<Topic>

type ParsedCommand = | LegacyCommand | Class<Command>

type ParsedPlugin = {
  topic?: ParsedTopic,
  topics?: ParsedTopic[],
  commands?: (ParsedCommand | {default: ParsedCommand})[]
}

type CachedCommand = {
  id: string,
  topic: string,
  command?: ?string,
  aliases?: string[],
  args: Arg[],
  flags: Flag[],
  description: ?string,
  help?: ?string,
  usage?: ?string,
  hidden: boolean
}

type CachedTopic = {
  topic: string,
  description?: ?string,
  hidden: boolean
}

type CachedPlugin = {
  name: string,
  path: string,
  version: string,
  commands: CachedCommand[],
  topics: CachedTopic[]
}

type CacheData = {
  version: string,
  plugins: {[path: string]: CachedPlugin}
}

type PJSON = {
  dependencies?: { [name: string]: string }
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

  deletePlugin (name: string) {
    for (let k of Object.keys(this.cache.plugins)) {
      if (this.cache.plugins[k].name === name) {
        this.debug(`Clearing cache for ${k}`)
        this.constructor.updated = true
        delete this.cache.plugins[k]
      }
    }
    this.save()
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

function undefaultTopic (t: (ParsedTopic | {default: ParsedTopic})): ParsedTopic {
  if (t.default) return (t.default: any)
  return t
}

function undefaultCommand (c: (ParsedCommand | {default: ParsedCommand})): ParsedCommand {
  if (c.default && typeof c.default !== 'boolean') return (c.default: any)
  return (c: any)
}

export class Plugin extends Base {
  constructor (type: PluginType, path: string, config: Config, cache: Cache) {
    super(config)
    this.cache = cache
    this.type = type
    this.path = path
    let p = this.fetch()
    this.name = p.name
    this.version = p.version
  }

  type: PluginType
  path: string
  cache: Cache
  name: string
  version: string

  get commands (): CachedCommand[] {
    return this.fetch().commands
  }

  get topics (): CachedTopic[] {
    return this.fetch().topics
  }

  findCommand (cmd: string): ?Class<Command> {
    let c = this.commands.find(c => c.id === cmd || (c.aliases || []).includes(cmd))
    if (!c) return
    let {topic, command} = c
    let p = this.require()
    let Command = (p.commands || [])
      .map(undefaultCommand)
      .find(d => topic === d.topic && command === d.command)
    if (!Command) return
    return typeof Command === 'function' ? Command : this.buildCommand((Command: any))
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

  buildCommand (c: LegacyCommand): Class<Command> {
    if (!c.topic) throw new Error('command has no topic')
    let Base = (c.needsApp || c.wantsApp)
    ? mixins.app(Command, {required: !!c.needsApp})
    : Command
    return class extends Base {
      static topic = c.topic
      static command = c.command
      static description = c.description
      static hidden = c.hidden
      static args = c.args || []
      static flags = c.flags || []
      static variableArgs = c.variableArgs

      run () {
        const ctx = {
          supportsColor: this.color.enabled,
          auth: {},
          debug: this.config.debug,
          flags: this.flags,
          args: c.variableArgs ? this.argv : this.args,
          // flow$ignore
          app: this.app
        }
        if (c.needsAuth) {
          ctx.auth.password = process.env.HEROKU_API_KEY
          if (!ctx.auth.password) {
            const netrc = require('netrc')()
            const host = netrc['api.heroku.com']
            if (host) ctx.auth.password = host.password
          }
          if (!ctx.auth.password) throw new Error('Not logged in')
        }
        return c.run(ctx)
      }
    }
  }

  fetch (): CachedPlugin {
    let c = this.cache.plugin(this.path)
    if (c) return c
    try {
      this.debug('updating cache for ' + this.path)
      return this.updatePlugin(this.require())
    } catch (err) {
      if (this.type === 'builtin') throw err
      this.warn(err)
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
      flags: c.flags,
      help: c.help,
      usage: c.usage,
      hidden: !!c.hidden,
      aliases: c.aliases
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

export default class Plugins extends Base {
  constructor (config: Config) {
    super(config)
    this.config = config
    this.cache = new Cache(config)
    this.linkedPlugins = new LinkedPlugins(config, this)
    this.plugins = [new Plugin('builtin', './commands', config, this.cache)]
    .concat(this.linkedPlugins.list())
    .concat(this.userPlugins)
    .concat(this.corePlugins)
    this.cache.save()
    this.yarn = new Yarn(this.config)
  }

  linkedPlugins: LinkedPlugins
  plugins: Plugin[]
  cache: Cache
  yarn: Yarn

  get corePlugins (): Plugin[] {
    return (this.config._cli.plugins || []).map(name => {
      return new Plugin('core', path.join(this.config.root, 'node_modules', name), this.config, this.cache)
    })
  }

  get userPlugins (): Plugin[] {
    const pjson = this.userPluginsPJSON
    return Object.keys(pjson.dependencies || {}).map(name => {
      return new Plugin('user', this.userPluginPath(name), this.config, this.cache)
    })
  }

  get userPluginsPJSON (): PJSON {
    try {
      return this.fs.readJSONSync(path.join(this.userPluginsDir, 'package.json'))
    } catch (err) {
      return { dependencies: {} }
    }
  }

  list () {
    return this.plugins
  }

  isPluginInstalled (name: string): boolean {
    return !!this.plugins.find(p => p.name === name)
  }

  findCommand (cmd: string): ?Class<Command> {
    for (let plugin of this.plugins) {
      let c = plugin.findCommand(cmd)
      if (c) return c
    }
  }

  commandsForTopic (topic: string): Class<Command>[] {
    let commands = this.plugins.reduce((t, p) => {
      try {
        return t.concat(p.commands
          .filter(c => c.topic === topic)
          .map(c => (p.findCommand(c.id): any)))
      } catch (err) {
        this.warn(err, `error reading plugin ${p.name}`)
        return t
      }
    }, [])
    return uniqby(commands, 'id')
  }

  findTopic (cmd: string): ?Class<Topic> {
    let name = cmd.split(':')[0]
    for (let plugin of this.plugins) {
      let t = plugin.findTopic(name)
      if (t) return t
    }
  }

  async setupUserPlugins () {
    const pjson = path.join(this.userPluginsDir, 'package.json')
    const yarnrc = path.join(this.userPluginsDir, '.yarnrc')
    this.fs.mkdirpSync(this.userPluginsDir)
    if (!this.fs.existsSync(pjson)) this.fs.writeFileSync(pjson, JSON.stringify({private: true}))
    if (!this.fs.existsSync(yarnrc)) this.fs.writeFileSync(yarnrc, 'registry "https://cli-npm.heroku.com/"')
    await this.yarn.exec()
  }

  async install (name: string) {
    let unlock = await lock.write(this.lockfile, {skipOwnPid: true})
    await this.setupUserPlugins()
    if (this.plugins.find(p => p.name === name)) throw new Error(`Plugin ${name} is already installed`)
    if (!this.config.debug) this.action.start(`Installing plugin ${name}`)
    await this.yarn.exec(['add', name])
    this.clearCache(name)
    try {
      // flow$ignore
      let plugin = (require(this.userPluginPath(name)): ParsedPlugin)
      if (!plugin.commands) throw new Error(`${name} does not appear to be a Heroku CLI plugin`)
    } catch (err) {
      await unlock()
      this.error(err, false)
      await this.uninstall(name)
      this.exit(1)
    }
    this.action.stop()
    await unlock()
  }

  /**
   * check if a plugin needs an update
   * @param {string} name - plugin name to check
   * @returns {string} - latest version if needs update, undefined otherwise
   */
  async needsUpdate (name: string): Promise<?string> {
    let info = await this.yarn.info(name)
    let plugin = this.plugins.find(p => p.name === name)
    if (!plugin) throw new Error(`${name} not installed`)
    let latest = info['dist-tags'].latest
    if (latest === plugin.version) return
    return latest
  }

  async update (name: string, version: string) {
    await this.yarn.exec(['upgrade', `${name}@${version}`])
    this.clearCache(name)
  }

  async uninstall (name: string) {
    let unlock = await lock.write(this.lockfile, {skipOwnPid: true})
    let plugin = this.plugins.filter(p => !['core', 'builtin'].includes(p.type)).find(p => p.name === name)
    if (!plugin) throw new Error(`${name} is not installed`)
    switch (plugin.type) {
      case 'user': {
        if (!this.config.debug) this.action.start(`Uninstalling plugin ${name}`)
        await this.yarn.exec(['remove', name])
        break
      }
      case 'link': {
        if (!this.config.debug) this.action.start(`Unlinking plugin ${name}`)
        this.linkedPlugins.remove(plugin.path)
        break
      }
    }
    this.clearCache(name)
    await unlock()
    this.action.stop()
  }

  async addLinkedPlugin (p: string) {
    await this.linkedPlugins.add(p)
  }

  async refreshLinkedPlugins () {
    await this.linkedPlugins.refresh()
  }

  clearCache (name: string) {
    this.cache.deletePlugin(name)
  }

  get userPluginsDir (): string { return path.join(this.config.dirs.data, 'plugins') }
  userPluginPath (name: string): string { return path.join(this.userPluginsDir, 'node_modules', name) }

  get topics (): CachedTopic[] {
    return uniqby(this.plugins.reduce((t, p) => t.concat(p.topics), []), 'topic')
  }

  get lockfile (): string { return path.join(this.config.dirs.cache, 'plugins.lock') }

  config: Config
}
