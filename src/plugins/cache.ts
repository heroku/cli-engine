import * as path from 'path'
import { rwlockfile } from 'rwlockfile'
import _ from 'ts-lodash'

import Config, {ICommand, ITopic} from '../config'

import {Plugin} from '.'
import File from './file'

export interface CacheCommand {
  _version?: string
  id: string
  hidden: boolean
  help: string
  buildHelp: string
  buildHelpLine: [string, string | undefined]
  aliases: string[]
  description: string | undefined
  usage: string | undefined
  plugin: {name: string, version: string, type: string, root: string}
}

export type RunFn = (argv: string[], config: Config) => Promise<any>

export interface CacheTypes {
  topics: {
    input: ITopic[]
    output: ITopic[]
  }
  commands: {
    input: ICommand[]
    output: CacheCommand[]
  }
}

export default class PluginCache extends File {
  readonly cacheKey: string
  private config: Config

  constructor(config: Config, {type, name, version}: Plugin) {
    const file = path.join(config.cacheDir, 'plugin_cache', [type, `${name}.json`].join(path.sep))
    super('plugin:cache', file)
    this.config = config
    this.type = 'cache'
    this.cacheKey = [config.version, version].join(':')
  }

  @rwlockfile('lock', 'read')
  async fetch<T extends keyof CacheTypes>(key: T, fn: () => Promise<CacheTypes[T]['input']>): Promise<CacheTypes[T]['output']> {
    let [persist, cacheKey] = await this.get<CacheTypes[T]['output'], string>(key, 'cache_key')
    if (persist && cacheKey && cacheKey === this.cacheKey) return persist
    else {
      this.debug('fetching', key)
      let input = await fn()
      try {
        let [,persist] = await Promise.all([
          this.lock.add('write', {timeout: 200, reason: 'cache'}),
          this.persist(key, input)
        ])
        await this.set(['cache_key', this.cacheKey], [key, persist])
        return persist
      } catch (err) {
        this.debug(err)
        return this.persist(key, input)
      } finally {
        await this.lock.remove('write')
      }
    }
  }

  private async persist<T extends keyof CacheTypes>(key: T, v: CacheTypes[T]['input']): Promise<CacheTypes[T]['output']> {
    const map: any = {
      commands: async (commands: ICommand[]): Promise<CacheCommand[]> => {
        return Promise.all(commands.map(async c => {
            const [buildHelp, buildHelpLine] = await Promise.all([
              await c.buildHelp(this.config),
              await c.buildHelpLine(this.config),
            ])
            return {
              id: c.id,
              _version: c._version,
              description: c.description,
              usage: c.usage,
              plugin: _.pick(c.plugin!, ['name', 'version', 'type', 'root']),
              hidden: c.hidden,
              aliases: c.aliases || [],
              help: c.help || '',
              buildHelp,
              buildHelpLine,
            }
          }
        ))
      }
    }
    return key in map ? map[key](v) : v
  }
}
