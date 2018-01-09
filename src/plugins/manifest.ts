import * as path from 'path'
import { rwlockfile } from 'rwlockfile'
import _ from 'ts-lodash'

import Config from '../config'

import File from './file'

export interface UserPlugin {
  type: 'user'
  name: string
  tag: string
}
export interface LinkPlugin {
  type: 'link'
  name: string
  root: string
}

export type Plugin = LinkPlugin | UserPlugin

export default class PluginManifest extends File {
  constructor(config: Config) {
    super('plugin:manifest', path.join(config.dataDir, 'plugins', 'plugins.json'))
  }

  @rwlockfile('lock', 'read')
  async list(): Promise<Plugin[]> {
    const plugins = (await this.get<Plugin[]>('plugins') || [])
    const [link, user] = _.partition(plugins, ['type', 'link'])
    return [...link, ...user]
  }

  @rwlockfile('lock', 'write')
  async add(plugin: UserPlugin | LinkPlugin) {
    this.debug('add', plugin)
    await this.remove(plugin)
    let plugins = await this.list()
    await this.set(['plugins', plugins])
  }

  @rwlockfile('lock', 'write')
  async remove({ name, root }: { name?: string; root: string } | { name: string; root?: string }) {
    this.debug('remove', { name, root })
    let plugins = await this.list()
    let length = plugins.length
    plugins = plugins.filter(p => p.name !== name)
    if (root) {
      plugins = plugins.filter(p => p.type === 'link' && p.root !== root)
    }
    if (length === plugins.length) return
    await this.set(['plugins', plugins])
  }
}
