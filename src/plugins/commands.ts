import cli from 'cli-ux'
import * as path from 'path'
import { Observable } from 'rxjs'
import * as Rx from 'rxjs/rx'
import _ from 'ts-lodash'

import Config, {ICommand, IPluginModule} from '../config'
import deps from '../deps'

import { Plugin } from '.'
import { CacheCommand } from './cache'

export default class PluginCommands {
  constructor (private config: Config) {
  }

    pluginCommandIDs (plugin: Plugin): Observable<string> {
      plugin.debug('fetching IDs')

      const commandIDsFromDir = async (): Promise<string[]> => {
        function idFromPath(file: string) {
          const p = path.parse(file)
          const topics = p.dir.split(path.sep)
          let command = p.name !== 'index' && p.name
          return _.compact([...topics, command]).join(':')
        }
        try {
          if (!plugin.commandsDir) return []
          plugin.debug(`loading IDs from ${plugin.commandsDir}`)
          const files = await deps.globby(['**/*.+(js|ts)', '!**/*.+(d.ts|test.ts|test.js)'], {
            nodir: true,
            cwd: plugin.commandsDir,
          })
          const ids = files.map(idFromPath)
          plugin.debug(`commandIDsFromDir dir: %s ids: %s`, plugin.commandsDir, ids.join(' '))
          return ids
        } catch (err) {
          cli.warn(err, { context: plugin.name })
          return []
        }
      }

      if (plugin.type === 'builtin') return Rx.Observable.from(builtinCommandIDs(this.config))
      return Rx.Observable.from(commandIDsFromDir())
        .concat(commandIDsFromModule(this.config, plugin))
        .mergeMap(a => a)
        .catch(err => {
          cli.warn(err)
          return []
        })
    }

    get commandIDs(): Observable<string> {
      return this.config.engine.plugins.plugins.concatMap(this.pluginCommandIDs)
    }

    get commands(): Observable<ICommand> {
      const input = this.config.engine.plugins.plugins
      return Observable.zip(input, input.map(p => this.pluginCommandIDs(p)))
        .map(async ([plugin, ids]) => {
          const cache = new deps.PluginCache(this.config, plugin)
          const commands: CacheCommand[] = await cache.fetch('commands', (): Promise<ICommand[]> => {
            plugin.debug('fetching commands')
            return Rx.Observable.from(ids)
              .map(_.partial(findCommandInDir, plugin))
              .reduce((a, p) => a.concat([p]), [])
              .toPromise()
          })
          return commands
          .map(_.partial(rehydrateCommand, this.config, plugin))
        })
        .concatMap(a => a)
        .catch(err => { cli.warn(err); return [] })
        .concatMap(a => a)
    }
}

function findCommand(plugin: Plugin, id: string): ICommand {
  return findCommandInDir(plugin, id)
}

function findCommandInDir(plugin: Plugin, id: string): ICommand {
  let c = deps.util.undefault(require(commandPath(plugin, id)))
  if (!c.id) c.id = id
  c.plugin = plugin
  return c
}

function commandPath(plugin: Plugin, id: string): string {
  if (!plugin.commandsDir) throw new Error('commandsDir not set')
  return require.resolve(path.join(plugin.commandsDir, id.split(':').join(path.sep)))
}

async function commandIDsFromModule(config: Config, plugin: Plugin): Promise<string[]> {
  const m = await fetchModule(config, plugin)
  if (!m || !m.commands) return []
  return m.commands.map(m => m.id)
}

async function fetchModule(config: Config, plugin: Plugin): Promise<IPluginModule | undefined> {
  if (!plugin.pjson.main) return
  plugin.debug(`requiring ${plugin.name}@${plugin.version}`)

  const m: IPluginModule = {
    commands: [],
    topics: [],
    ...require(path.join(plugin.root, plugin.pjson.main!)),
  }

  if (m.topic) m.topics.push(m.topic)
  m.commands = m.commands.map(deps.util.undefault)

  await config.engine.hooks.run('plugins:parse', { module: m, pjson: plugin.pjson })

  let legacy = new deps.PluginLegacy(config)

  return legacy.convert(m)
}

function rehydrateCommand(cfg: Config, plugin: Plugin, c: CacheCommand): ICommand {
  return {
    ...c,
    _version: c._version as any,
    buildHelp: () => c.buildHelp,
    buildHelpLine: () => c.buildHelpLine,
    run: async (argv: string[], config = cfg) => {
      if (plugin.lock) await plugin.lock.add('read', { reason: 'running plugin' })
      let cmd = findCommand(plugin, c.id)
      let res
      if (!c._version || c._version === '0.0.0') {
        // this.debug('legacy @cli-engine/command version', c._version)
        res = await (cmd as any).run({ ...config, argv: argv.slice(4) })
      } else if (deps.semver.lt(c._version || '', '10.0.0')) {
        // this.debug('legacy @cli-engine/command version', c._version)
        let cvrtConfig = convertConfig(config as any)
        res = await (cmd as any).run({ ...cvrtConfig, argv: argv.slice(1) })
      } else if (deps.semver.lt(c._version || '', '11.0.0-beta.0')) {
        // this.debug(`legacy @cli-engine/command version`, c._version)
        res = await (cmd as any).run({ ...config, argv: argv.slice(2) })
      } else {
        res = await cmd.run(argv.slice(3), config)
      }
      if (plugin.lock) await plugin.lock.remove('read')
      return res
    },
  }
}

function convertConfig(config: Config): Partial<Config> {
  return _.pick(config, [
    'arch',
    'argv',
    'bin',
    'cacheDir',
    'channel',
    'commandsDir',
    'configDir',
    'corePlugins',
    'dataDir',
    'debug',
    'defaultCommand',
    'dirname',
    'errlog',
    'home',
    'hooks',
    'name',
    'npmRegistry',
    'pjson',
    'platform',
    'reexecBin',
    'root',
    's3',
    'shell',
    'topics',
    'updateDisabled',
    'userAgent',
    'userPluginsEnabled',
    'version',
    'windows',
  ])
}

function builtinCommandIDs(config: Config): string[] {
  const ids = ['commands', 'help', 'update', 'version', 'which']
  if (!config.userPluginsEnabled) return ids
  return [...ids, 'plugins', 'plugins:install', 'plugins:link', 'plugins:uninstall', 'plugins:update']
}
