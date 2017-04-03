// @flow

import Command, {Config, Topic, type Flag, type Arg} from 'cli-engine-command'
import type Output from 'cli-engine-command/lib/output'
import path from 'path'
import Yarn from './yarn'
import Plugin from './plugin'
import lock from 'rwlockfile'
import UserPlugins from './user_plugins'
import CorePlugins from './core_plugins'
import LinkedPlugins from './linked_plugins'
import uniqby from 'lodash.uniqby'
import {type LegacyCommand} from './legacy'
import fs from 'fs-extra'

type ParsedTopic = | {
  name?: ?string,
  topic?: ?string,
  description?: ?string,
  hidden?: ?boolean
} | Class<Topic>

type ParsedCommand = | LegacyCommand | Class<Command<*>>

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
  flags: {[name: string]: Flag<*>},
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

class Cache {
  static updated = false
  config: Config
  out: Output
  _cache: CacheData

  constructor (config: Config, output: Output) {
    this.config = config
    this.out = output
  }

  get file (): string { return path.join(this.config.dirs.cache, 'plugins.json') }
  get cache (): CacheData {
    if (this._cache) return this._cache
    let initial = {version: this.config.version, plugins: {}}
    try {
      this._cache = fs.readJSONSync(this.file)
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
    this.save()
  }

  deletePlugin (name: string) {
    for (let k of Object.keys(this.cache.plugins)) {
      if (this.cache.plugins[k].name === name) {
        this.out.debug(`Clearing cache for ${k}`)
        this.constructor.updated = true
        delete this.cache.plugins[k]
      }
    }
    this.save()
  }

  save () {
    if (!this.constructor.updated) return
    try {
      fs.writeJSONSync(this.file, this.cache)
    } catch (err) {
      this.out.warn(err)
    }
  }
}

export default class Plugins {
  constructor (output: Output) {
    this.out = output
    this.config = output.config
    this.yarn = new Yarn(output)
    this.cache = new Cache(output.config, output)
    this._linkedPlugins = new LinkedPlugins(this)
    this._userPlugins = new UserPlugins(this)
    this.plugins = [new Plugin('builtin', './commands', this)]
    .concat(this._linkedPlugins.list())
    .concat(this._userPlugins.list())
    .concat(new CorePlugins(this).list())
    this.cache.save()
  }

  _linkedPlugins: LinkedPlugins
  _userPlugins: UserPlugins
  plugins: Plugin[]
  cache: Cache
  yarn: Yarn
  out: Output

  pluginsUpdate () {
    this.out.action.start(`${this.config.name}: Updating plugins`)
    this._linkedPlugins.pluginsUpdate()
    this._userPlugins.pluginsUpdate()
    // TODO FIXME this.out.action.start(`${this.config.name}: Updating plugins`)
  }

  get userPluginsPJSON (): PJSON {
    try {
      return fs.readJSONSync(path.join(this.userPluginsDir, 'package.json'))
    } catch (err) {
      return { dependencies: {} }
    }
  }

  get commands (): CachedCommand[] {
    let commands = []
    for (let plugin of this.plugins) {
      try {
        commands = commands.concat(plugin.commands)
      } catch (err) {
        this.out.warn(err, `error reading plugin ${plugin.name}`)
      }
    }
    return commands
  }

  list () {
    return this.plugins
  }

  isPluginInstalled (name: string): boolean {
    return !!this.plugins.find(p => p.name === name)
  }

  findCommand (cmd: string): ?Class<Command<*>> {
    for (let plugin of this.plugins) {
      let c = plugin.findCommand(cmd)
      if (c) return c
    }
  }

  commandsForTopic (topic: string): Class<Command<*>>[] {
    let commands = this.plugins.reduce((t, p) => {
      try {
        return t.concat(p.commands
          .filter(c => c.topic === topic)
          .map(c => (p.findCommand(c.id): any)))
      } catch (err) {
        this.out.warn(err, `error reading plugin ${p.name}`)
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
    fs.mkdirpSync(this.userPluginsDir)
    if (!fs.existsSync(pjson)) fs.writeFileSync(pjson, JSON.stringify({private: true}))
    if (!fs.existsSync(yarnrc)) fs.writeFileSync(yarnrc, 'registry "https://cli-npm.heroku.com/"')
    await this.yarn.exec()
  }

  async install (name: string) {
    let unlock = await lock.write(this.lockfile, {skipOwnPid: true})
    await this.setupUserPlugins()
    if (this.plugins.find(p => p.name === name)) throw new Error(`Plugin ${name} is already installed`)
    if (!this.config.debug) this.out.action.start(`Installing plugin ${name}`)
    await this.yarn.exec(['add', name])
    this.clearCache(name)
    try {
      // flow$ignore
      let plugin = (require(this.userPluginPath(name)): ParsedPlugin)
      if (!plugin.commands) throw new Error(`${name} does not appear to be a Heroku CLI plugin`)
    } catch (err) {
      await unlock()
      this.out.error(err, false)
      await this.uninstall(name, true)
      this.out.exit(1)
    }
    this.out.action.stop()
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

  async uninstall (name: string, forceSilently: boolean = false) {
    let unlock = await lock.write(this.lockfile, {skipOwnPid: true})
    let plugin = this.plugins.filter(p => !['core', 'builtin'].includes(p.type)).find(p => p.name === name)
    if (!plugin && forceSilently) {
      await this.yarn.exec(['remove', name])
      this.clearCache(name)
      await unlock()
      this.out.action.stop()
      return
    }
    if (!plugin) throw new Error(`${name} is not installed`)
    switch (plugin.type) {
      case 'user': {
        if (!this.config.debug) this.out.action.start(`Uninstalling plugin ${name}`)
        await this.yarn.exec(['remove', name])
        break
      }
      case 'link': {
        if (!this.config.debug) this.out.action.start(`Unlinking plugin ${name}`)
        this._linkedPlugins.remove(plugin.path)
        break
      }
    }
    this.clearCache(name)
    await unlock()
    this.out.action.stop()
  }

  async addLinkedPlugin (p: string) {
    await this._linkedPlugins.add(p)
    this.cache.save()
  }

  async refreshLinkedPlugins () {
    await this._linkedPlugins.refresh()
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
