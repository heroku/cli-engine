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

export default class Plugins {
  constructor (output: Output) {
    this.out = output
    this.config = output.config
    this.cache = new Cache(output)

    this.builtin = new BuiltinPlugins(this)
    this.linked = new LinkedPlugins(this)
    this.user = new UserPlugins(this)
    this.core = new CorePlugins(this)

    this.plugins = this.cache.fetchManagers(
      this.builtin,
      this.linked,
      this.user,
      this.core
    )
  }

  builtin: BuiltinPlugins
  linked: LinkedPlugins
  user: UserPlugins
  core: CorePlugins
  plugins: Plugin[]
  cache: Cache
  out: Output

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
      if (plugin.cachedPlugin.namespace) {
        if (plugin.cachedPlugin.namespace !== cmd.split(':')[0]) continue
        let c = plugin.findCommand(cmd.replace(/\w+:/, ''))
        if (c) return c
      }
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
    if (!cmd) return
    for (let plugin of this.plugins) {
      if (plugin.cachedPlugin.namespace) {
        if (plugin.cachedPlugin.namespace !== cmd.split(':')[0]) continue
        let c = plugin.findTopic(cmd.replace(/\w+:/, ''))
        if (c) return c
      }
      let t = plugin.findTopic(cmd)
      if (t) return t
    }
    let name = cmd.split(':').slice(0, cmd.split(':').length - 1).join(':')
    return this.findTopic(name)
  }

  findNamespaced (namespace:string) : Array<Plugin> {
    return this.plugins.filter(p => p.namespace === namespace)
  }

  async install (name: string, tag: string = 'latest') {
    if (this.plugins.find(p => p.name === name && p.tag === tag)) throw new Error(`Plugin ${name} is already installed`)
    let path = await this.user.install(name, tag)
    this.clearCache(path)
  }

  async update () {
    if (this.user.list().length === 0) return
    await this.user.update()
    this.clearCache(...this.user.list().map(p => p.path))
  }

  async uninstall (name: string) {
    let plugin = this.plugins.filter(p => ['user', 'link'].includes(p.type)).find(p => p.name === name)
    if (!plugin) throw new Error(`${name} is not installed`)
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
    this.out.action.stop()
  }

  addPackageToPJSON (name: string, version: string = '*') {
    this.user.addPackageToPJSON(name, version)
  }

  async addLinkedPlugin (p: string) {
    let name = this.linked.checkLinked(p)
    if (this.plugins.find(p => p.type === 'user' && p.name === name)) {
      throw new Error(`${name} is already installed.\nUninstall with ${this.out.color.cmd(this.config.bin + ' plugins:uninstall ' + name)}`)
    }
    Namespaces.throwErrorIfNotPermitted(p, this.config)

    await this.linked.add(p)
    this.clearCache(p)
  }

  async refreshLinkedPlugins () {
    let paths: string[] = await this.linked.refresh()
    this.clearCache(...paths)
  }

  clearCache (...paths: string[]) {
    this.cache.deletePlugin(...paths)
  }

  get topics (): CachedTopic[] {
    return uniqby(this.plugins.reduce((t, p) => t.concat(p.topics), []), 'topic')
  }

  config: Config
}
