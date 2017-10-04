// @flow

import {type Config} from 'cli-engine-config'
import Command, {Topic} from 'cli-engine-command'
import Plugin from './plugin'
import LinkedPlugins from './linked'
import UserPlugins from './user'
import BuiltinPlugins from './builtin'
import CorePlugins from './core'
import uniqby from 'lodash.uniqby'
import Cache, {type CachedCommand, type CachedTopic} from './cache'
import Lock from '../lock'
import {CLI} from 'cli-ux'

export default class Plugins {
  builtin: BuiltinPlugins
  linked: LinkedPlugins
  user: UserPlugins
  core: CorePlugins
  plugins: Plugin[]
  cache: Cache
  lock: Lock
  loaded: boolean
  config: Config
  cli: CLI

  constructor (config: Config) {
    this.config = config
    this.cache = new Cache(config)
    this.cli = new CLI({mock: config.mock})

    this.builtin = new BuiltinPlugins(this)
    this.linked = new LinkedPlugins(this)
    this.user = new UserPlugins(this)
    this.core = new CorePlugins(this)
    this.lock = new Lock(this.config)
  }

  async load () {
    if (this.loaded) return
    this.plugins = await this.cache.fetchManagers(
      this.linked,
      this.user,
      this.core,
      this.builtin
    )
    this.loaded = true
  }

  get commands (): CachedCommand[] {
    let commands = []
    for (let plugin of this.plugins) {
      try {
        commands = commands.concat(plugin.commands)
      } catch (err) {
        this.cli.warn(err, `error reading plugin ${plugin.name}`)
      }
    }
    return commands
  }

  async list () {
    await this.load()
    return this.plugins
  }

  isPluginInstalled (name: string): boolean {
    return !!this.plugins.find(p => p.name === name)
  }

  async findPluginWithCommand (id: string): Promise<?Plugin> {
    for (let plugin of await this.list()) {
      if (await plugin.findCommand(id)) return plugin
    }
  }

  async findCommand (id: string): Promise<?Class<Command<*>>> {
    for (let plugin of this.plugins) {
      let c = await plugin.findCommand(id)
      if (c) return c
    }
  }

  async findCachedCommand (id: string): Promise<?CachedCommand> {
    for (let plugin of this.plugins) {
      let c = await plugin.findCachedCommand(id)
      if (c) return c
    }
  }

  async commandsForTopic (topic: string): Promise<CachedCommand[]> {
    let commands = this.plugins.reduce((t, p) => {
      try {
        return t.concat(p.commands
          .filter(c => c.topic === topic))
      } catch (err) {
        this.cli.warn(err, `error reading plugin ${p.name}`)
        return t
      }
    }, [])
    commands = await Promise.all(commands)
    return uniqby(commands, 'id')
  }

  async subtopicsForTopic (id: string): Promise<?CachedTopic[]> {
    if (!id) return
    for (let plugin of this.plugins) {
      let t = await plugin.findTopic(id)
      if (t) {
        return plugin.topics.filter(t => {
          if (!t.id) return false
          if (t.id === id) return false
          let re = new RegExp(`^${id}`)
          return !!(t.id).match(re)
        })
      }
    }
  }

  async findTopic (id: string): Promise<?Class<Topic>> {
    if (!id) return
    for (let plugin of this.plugins) {
      let t = await plugin.findTopic(id)
      if (t) return t
    }
  }

  async install (name: string, tag: string = 'latest') {
    let downgrade = await this.lock.upgrade()

    await this.load()
    if (this.plugins.find(p => p.name === name && p.tag === tag)) throw new Error(`Plugin ${name} is already installed`)

    let path = await this.user.install(name, tag)
    this.clearCache(path)
    await downgrade()
  }

  async update () {
    if (this.user.list().length === 0) return
    this.cli.action.start(`${this.config.name}: Updating plugins`)
    let downgrade = await this.lock.upgrade()
    await this.user.update()
    this.clearCache(...(await this.user.list()).map(p => p.path))
    await downgrade()
    this.cli.action.stop()
  }

  async uninstall (name: string) {
    await this.load()
    let plugin = this.plugins.filter(p => ['user', 'link'].includes(p.type)).find(p => p.name === name)
    if (!plugin) throw new Error(`${name} is not installed`)
    let downgrade = await this.lock.upgrade()
    switch (plugin.type) {
      case 'user': {
        if (!this.config.debug) this.cli.action.start(`Uninstalling plugin ${name}`)
        await this.user.remove(name)
        break
      }
      case 'link': {
        if (!this.config.debug) this.cli.action.start(`Unlinking plugin ${name}`)
        this.linked.remove(plugin.path)
        break
      }
    }
    this.clearCache(plugin.path)
    await downgrade()
    this.cli.action.stop()
  }

  addPackageToPJSON (name: string, version: string = '*') {
    this.user.addPackageToPJSON(name, version)
  }

  async addLinkedPlugin (p: string) {
    let downgrade = await this.lock.upgrade()

    await this.load()
    await this.linked.add(p)
    this.clearCache(p)
    await downgrade()
  }

  clearCache (...paths: string[]) {
    this.cache.deletePlugin(...paths)
  }

  get topics (): CachedTopic[] {
    return uniqby(this.plugins.reduce((t, p) => t.concat(p.topics), []), 'id')
  }
}
