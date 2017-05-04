// @flow

import {type Config} from 'cli-engine-config'
import Command, {Topic} from 'cli-engine-command'
import type Output from 'cli-engine-command/lib/output'
import {PluginPath} from './plugin_manager'

import {convertFromV5} from './legacy'
import {type CachedCommand, type CachedPlugin, type CachedTopic} from './cache'

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

  findCommand (cmd: string): ?Class<Command<*>> {
    if (!cmd) return
    let c = this.commands.find(c => c.id === cmd || (c.aliases || []).includes(cmd))
    if (!c) return
    let {topic, command} = c
    let p = this.pluginPath.require()
    let Command = (p.commands || [])
      .find(d => topic === d.topic && command === d.command)
    if (!Command) return
    return typeof Command === 'function' ? Command : convertFromV5((Command: any))
  }

  findTopic (name: string): ?Class<Topic> {
    let t = this.topics.find(t => t.topic === name)
    if (!t) return
    let plugin = this.pluginPath.require()
    let Topic = (plugin.topics || [])
      .find(t => [t.topic, t.name].includes(name))
    if (!Topic && plugin.topic) Topic = plugin.topic.topic === name ? plugin.topic : ''
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
}
