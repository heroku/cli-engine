import { IPluginModule, ITopic, ITopics } from '@cli-engine/config'
import cli from 'cli-ux'
import * as path from 'path'
import { Observable } from 'rxjs'
import _ from 'ts-lodash'

import Config from '../config'
import deps from '../deps'

import { Plugin } from '.'

export default class PluginTopics {
  constructor(protected config: Config) {}

  get topics(): Observable<ITopic> {
    const pluginTopics = async (plugin: Plugin): Promise<ITopic[]> => {
      try {
        plugin.debug('fetching topics')

        const cache = new deps.PluginCache(this.config, plugin)
        let topics: ITopic[] = await cache.fetch('topics', async () => {
          plugin.debug('fetching topics')
          const m = await this.fetchModule(plugin)
          if (!m) return []
          return m.topics
        })

        let pjsonTopics = plugin.pjson['cli-engine'].topics
        if (pjsonTopics) topics = topics.concat(topicsToArray(pjsonTopics))
        return topics
      } catch (err) {
        cli.warn(err)
        return []
      }
    }
    return this.config.engine.plugins.plugins.concatMap(pluginTopics).concatMap(a => a)
  }

  private async fetchModule(plugin: Plugin): Promise<IPluginModule | undefined> {
    if (!plugin.pjson.main) return
    plugin.debug(`requiring ${plugin.name}@${plugin.version}`)

    const m: IPluginModule = {
      topics: [],
      ...require(path.join(plugin.root, plugin.pjson.main!)),
    }

    if (m.topic) m.topics.push(m.topic)

    await this.config.engine.hooks.run('plugins:parse', { module: m, pjson: plugin.pjson })
  }
}

export function topicsToArray(input: ITopic[] | ITopics | undefined): ITopic[]
export function topicsToArray(input: ITopics | undefined, base: string): ITopic[]
export function topicsToArray(input: ITopic[] | ITopics | undefined, base?: string): ITopic[] {
  if (!input) return []
  base = base ? `${base}:` : ''
  if (Array.isArray(input)) {
    return input.concat(_.flatMap(input, t => topicsToArray(t.subtopics, `${base}${t.name}`)))
  }
  return _.flatMap(Object.keys(input), k => {
    return [{ ...input[k], name: `${base}${k}` }].concat(topicsToArray(input[k].subtopics, `${base}${input[k].name}`))
  })
}
