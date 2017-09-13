import {Config, ICommand, Topic} from 'cli-engine-config'
import {PluginPath} from './manager'
import * as path from 'path'
import {CLI} from 'cli-ux'

import {CachedCommand, CachedPlugin} from './cache'

const debug = require('debug')('cli:plugins')

export class Plugin {
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

  get topics (): Topic[] {
    return this.cachedPlugin.topics
  }

  async findCommand (id: string): Promise<ICommand | undefined> {
    if (!id) return
    let c = this.commands.find(c => c.id === id || (c.aliases || []).includes(id))
    if (!c) return
    let {topic, command} = c
    let p = await this.pluginPath.require()
    let Command = (p.commands || [])
      .find(d => topic === d.topic && command === d.command)
    if (!Command) return
    return typeof Command === 'function' ? Command : this.convertFromV5(Command)
  }

  async findTopic (id: string): Promise<Topic | undefined> {
    let t = this.topics.find(t => t.id === id)
    if (!t) return
    let plugin = await this.pluginPath.require()
    let topic = (plugin.topics || [])
      .find(t => [t.id].includes(id))
    return topic
  }

  convertFromV5 (command: any): ICommand {
    if (!this.config.legacyConverter) {
      debug(command)
      throw new Error('received v5 command but no legacyConverter was specified')
    }
    const converter = require(path.join(this.config.root, this.config.legacyConverter))
    return converter.convertFromV5(command)
  }
}
