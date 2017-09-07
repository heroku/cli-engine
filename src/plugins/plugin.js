// @flow

import {type Config} from 'cli-engine-config'
import Command, {Topic} from 'cli-engine-command'
import type Output from 'cli-engine-command/lib/output'
import {PluginPath} from './manager'
import path from 'path'

import {type CachedCommand, type CachedPlugin, type CachedTopic} from './cache'

const debug = require('debug')('cli:plugins')

export default class Plugin {
  constructor (out: Output, pluginPath: PluginPath, cachedPlugin: CachedPlugin) {
    this.config = out.config
    this.out = out
    this.pluginPath = pluginPath
    this.cachedPlugin = cachedPlugin
  }

  pluginPath: PluginPath
  cachedPlugin: CachedPlugin
  config: Config
  out: Output

  get tag (): string | void {
    return this.pluginPath.tag
  }

  get type (): string {
    return this.pluginPath.type
  }

  get path (): string {
    return this.pluginPath.path
  }

  get name (): string {
    return this.cachedPlugin.name
  }

  get version (): string {
    return this.cachedPlugin.version
  }

  get commands (): CachedCommand[] {
    return this.cachedPlugin.commands
  }

  get topics (): CachedTopic[] {
    return this.cachedPlugin.topics
  }

  async findCommand (id: string): Promise<?Class<Command<*>>> {
    if (!id) return
    let c = this.commands.find(c => c.id === id || (c.aliases || []).includes(id))
    if (!c) return
    let {topic, command} = c
    let p = await this.pluginPath.require()
    let Command = (p.commands || [])
      .find(d => topic === d.topic && command === d.command)
    if (!Command) return
    return typeof Command === 'function' ? Command : this.convertFromV5((Command: any))
  }

  async findTopic (id: string): Promise<?Class<Topic>> {
    let t = this.topics.find(t => t.id === id)
    if (!t) return
    let plugin = await this.pluginPath.require()
    let Topic = (plugin.topics || [])
      .find(t => [t.id].includes(id))
    if (!Topic) return
    return typeof Topic === 'function' ? Topic : this.buildTopic(t)
  }

  buildTopic (t: CachedTopic): Class<Topic> {
    return class extends Topic {
      static topic = t.id
      static description = t.description
      static hidden = t.hidden
    }
  }

  convertFromV5 (command: any): Class<Command<*>> {
    if (!this.config.legacyConverter) {
      debug(command)
      throw new Error('received v5 command but no legacyConverter was specified')
    }
    const converter = require(path.join(this.config.root, this.config.legacyConverter))
    return converter.convertFromV5(command)
  }
}
