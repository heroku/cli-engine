// @flow

import type {Config} from 'cli-engine-config'
import Command, {Topic} from 'cli-engine-command'
import {PluginPath} from './manager'
import path from 'path'
import {CLI} from 'cli-ux'

import {type CachedCommand, type CachedPlugin, type CachedTopic} from './cache'

const debug = require('debug')('cli:plugins')

export default class Plugin {
  constructor (config: Config, pluginPath: PluginPath, cachedPlugin: CachedPlugin) {
    this.config = config
    this.cli = new CLI({mock: config.mock})
    this.pluginPath = pluginPath
    this.cachedPlugin = cachedPlugin
  }

  pluginPath: PluginPath
  cachedPlugin: CachedPlugin
  config: Config
  cli: CLI

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

  async findCachedCommand (id: string): Promise<?CachedCommand> {
    if (!id) return
    return this.commands.find(c => c.id === id || (c.aliases || []).includes(id))
  }

  async findCommand (id: string): Promise<?Class<Command<*>>> {
    const cachedCommand = await this.findCachedCommand(id)
    if (!cachedCommand) return
    let {topic, command} = cachedCommand
    let p = await this.pluginPath.require()
    let Command = (p.commands || [])
      .find(d => topic === d.topic && command === d.command)
    if (!Command) return
    return typeof Command === 'function' ? Command : this.convertFromV5((Command: any))
  }

  async findTopic (id: string): Promise<?Class<Topic>> {
    let t = this.topics.find(t => t.id === id)
    if (!t) return
    return this.buildTopic(t)
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
