// @flow

import {type Config} from 'cli-engine-config'
import Command, {Topic} from 'cli-engine-command'
import type Output from 'cli-engine-command/lib/output'
import Plugin from './plugin'
import LinkedPlugins from './linked'
import UserPlugins from './user'
import BuiltinPlugins from './builtin'
import CorePlugins from './core'
import uniqby from 'lodash.uniqby'
import Cache, {type CachedCommand, type CachedTopic} from './cache'
import Namespaces from '../namespaces'
import Lock from '../lock'

export default class Plugins {
  builtin: BuiltinPlugins
  linked: LinkedPlugins
  user: UserPlugins
  core: CorePlugins
  plugins: Plugin[]
  cache: Cache
  out: Output
  lock: Lock
  loaded: boolean
  config: Config

  constructor (output: Output) {
    this.out = output
    this.config = output.config
    this.cache = new Cache(output)

    this.builtin = new BuiltinPlugins(this)
    this.linked = new LinkedPlugins(this)
    this.user = new UserPlugins(this)
    this.core = new CorePlugins(this)
    this.lock = new Lock(this.out)
  }

  async load () {
    if (this.loaded) return
    this.plugins = await this.cache.fetchManagers(
      this.builtin,
      this.linked,
      this.user,
      this.core
    )
    this.loaded = true
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

  async list () {
    await this.load()
    return this.plugins
  }

  isPluginInstalled (name: string): boolean {
    return !!this.plugins.find(p => p.name === name)
  }

  async findPluginWithCommand (cmd: string): Promise<?Plugin> {
    for (let plugin of await this.list()) {
      if (await plugin.findCommand(cmd)) return plugin
    }
  }

  async findCommand (cmd: string): Promise<?Class<Command<*>>> {
    for (let plugin of this.plugins) {
      let c = await plugin.findCommand(cmd)
      if (c) return c
    }
  }

  async commandsForTopic (topic: string): Promise<Class<Command<*>>[]> {
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
    commands = await Promise.all(commands)
    return uniqby(commands, 'id')
  }

  async findTopic (cmd: string): Promise<?Class<Topic>> {
    if (!cmd) return
    for (let plugin of this.plugins) {
      let t = await plugin.findTopic(cmd)
      if (t) return t
    }
  }

  findNamespaced (namespace: string): Array<Plugin> {
    return this.plugins.filter(p => p.namespace === namespace)
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
    this.out.action.start(`${this.config.name}: Updating plugins`)
    let downgrade = await this.lock.upgrade()
    await this.user.update()
    this.clearCache(...(await this.user.list()).map(p => p.path))
    await downgrade()
  }

  async uninstall (name: string) {
    await this.load()
    let plugin = this.plugins.filter(p => ['user', 'link'].includes(p.type)).find(p => p.name === name)
    if (!plugin) throw new Error(`${name} is not installed`)
    let downgrade = await this.lock.upgrade()
    switch (plugin.type) {
      case 'user': {
        if (!this.config.debug) this.out.action.start(`Uninstalling plugin ${name}`)
        await this.user.remove(name)
        break
      }
      case 'link': {
        if (!this.config.debug) this.out.action.start(`Unlinking plugin ${name}`)
        this.linked.remove(plugin.path)
        break
      }
    }
    this.clearCache(plugin.path)
    await downgrade()
    this.out.action.stop()
  }

  addPackageToPJSON (name: string, version: string = '*') {
    this.user.addPackageToPJSON(name, version)
  }

  async addLinkedPlugin (p: string) {
    let downgrade = await this.lock.upgrade()

    await this.load()
    let name = this.linked.checkLinked(p)

    if (this.plugins.find(p => p.type === 'user' && p.name === name)) {
      throw new Error(`${name} is already installed.\nUninstall with ${this.out.color.cmd(this.config.bin + ' plugins:uninstall ' + name)}`)
    }

    Namespaces.throwErrorIfNotPermitted(p, this.config)

    await this.linked.add(p)
    this.clearCache(p)
    await downgrade()
  }

  clearCache (...paths: string[]) {
    this.cache.deletePlugin(...paths)
  }

  get topics (): CachedTopic[] {
    return uniqby(this.plugins.reduce((t, p) => t.concat(p.topics), []), 'topic')
  }
}
