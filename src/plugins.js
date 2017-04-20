// @flow

import {type Config} from 'cli-engine-config'
import Command, {Topic} from 'cli-engine-command'
import type Output from 'cli-engine-command/lib/output'
import Plugin from './plugins/plugin'
import LinkedPlugins from './plugins/linked'
import UserPlugins from './plugins/user'
import BuiltinPlugins from './plugins/builtin'
import CorePlugins from './plugins/core'
import uniqby from 'lodash.uniqby'
import Cache, {type CachedCommand, type CachedTopic} from './plugins/cache'

export default class Plugins {
  constructor (output: Output) {
    this.out = output
    this.config = output.config
    this.cache = new Cache(output)

    this.builtinPlugins = new BuiltinPlugins(this)
    this.linkedPlugins = new LinkedPlugins(this)
    this.userPlugins = new UserPlugins(this)
    this.corePlugins = new CorePlugins(this)

    this.plugins = this.builtinPlugins.list
    .concat(this.linkedPlugins.list)
    .concat(this.userPlugins.list)
    .concat(this.corePlugins.list)
    this.cache.save()
  }

  builtinPlugins: BuiltinPlugins
  linkedPlugins: LinkedPlugins
  userPlugins: UserPlugins
  corePlugins: CorePlugins
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

  async install (name: string, tag: string = 'latest') {
    if (this.plugins.find(p => p.name === name && p.options.tag === tag)) throw new Error(`Plugin ${name} is already installed`)
    await this.userPlugins.install(name, tag)
    this.clearCache(name)
  }

  async update () {
    if (this.userPlugins.list.length === 0) return
    await this.userPlugins.update()
    this.clearCache(...this.userPlugins.list.map(p => p.name))
  }

  async uninstall (name: string) {
    let plugin = this.plugins.filter(p => ['user', 'link'].includes(p.type)).find(p => p.name === name)
    if (!plugin) throw new Error(`${name} is not installed`)
    switch (plugin.type) {
      case 'user': {
        if (!this.config.debug) this.out.action.start(`Uninstalling plugin ${name}`)
        await this.userPlugins.remove(name)
        break
      }
      case 'link': {
        if (!this.config.debug) this.out.action.start(`Unlinking plugin ${name}`)
        this.linkedPlugins.remove(plugin.path)
        break
      }
    }
    this.clearCache(name)
    this.out.action.stop()
  }

  addPackageToPJSON (name: string, version: string = '*') {
    this.userPlugins.addPackageToPJSON(name, version)
  }

  async addLinkedPlugin (p: string) {
    await this.linkedPlugins.add(p)
  }

  async refreshLinkedPlugins () {
    await this.linkedPlugins.refresh()
  }

  clearCache (...names: string[]) {
    this.cache.deletePlugin(...names)
  }

  get topics (): CachedTopic[] {
    return uniqby(this.plugins.reduce((t, p) => t.concat(p.topics), []), 'topic')
  }

  config: Config
}
