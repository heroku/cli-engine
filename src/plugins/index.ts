import cli from 'cli-ux'
import * as path from 'path'
import { Package } from 'read-pkg'
import RWLockfile from 'rwlockfile'
import { Observable } from 'rxjs/Observable'
import * as Rx from 'rxjs/Rx'

import Config, { ICommand, IPluginManager, IPluginPJSON, ITopic } from '../config'
import deps from '../deps'

import PluginTopics from './topics'
import PluginCommands from './commands'

const debug = require('debug')('cli:plugins')

export type Debug = (...args: any[]) => void

export interface Plugin {
  type: 'builtin' | 'main' | 'core' | 'user' | 'link'
  name: string
  version: string
  root: string
  pjson: IPluginPJSON
  debug: Debug
  lock?: RWLockfile
  commandsDir?: string
  tag?: string
}

interface PartialPlugin {
  name?: string
  type: string
  root: string
}

interface TSConfig {
  compilerOptions: {
    rootDir?: string
    outDir?: string
  }
}

const getDebug = (type: string, pjson: IPluginPJSON) =>
  require('debug')(['cli', 'plugins', type, pjson.name, pjson.version].join(':'))

export default class PluginManager implements IPluginManager {
  protected debug = require('debug')('cli:plugins')
  private _pluginTopics: PluginTopics
  private _pluginCommands: PluginCommands

  constructor(private config: Config) {}

  get commandIDs(): Observable<string> {
    return this.pluginCommands.commandIDs
  }

  get commands(): Observable<ICommand> {
    return this.pluginCommands.commands
  }

  get topics(): Observable<ITopic> {
    return this.pluginTopics.topics
  }

  get plugins(): Observable<Plugin> {
    const builtinPlugin = () => {
      const root = path.join(__dirname, '../..')
      debug('builtin', root)
      return [{ type: 'builtin', root }]
    }

    const mainPlugin = () => {
      if (!this.config.commandsDir || !this.config.root) return Rx.Observable.empty()
      const root = this.config.root
      debug('main', root)
      return [{ type: 'main', root }]
    }

    const corePlugins = (): Rx.Observable<PartialPlugin> => {
      return Rx.Observable.from(this.config.corePlugins)
        .map(name => ({ type: 'core', name, root: pkgRoot(this.config.root!, name) }))
        .pipe(deps.util.collect)
        .do(core => debug('core', core.map(p => p.name)))
        .concatMap(c => c)
    }

    const manifestPlugins = () => {
      try {
        if (!this.config.userPluginsEnabled) return Rx.Observable.empty()
        const manifest = new deps.PluginManifest(this.config)
        return Rx.Observable.from(manifest.list())
          .concatMap(a => a)
          .map(p => {
            const root = path.join(this.config.dataDir, 'plugins/node_modules', p.name)
            const lockRoot =
              p.type === 'link'
                ? path.join(root, '.cli-engine')
                : path.join(this.config.dataDir, 'plugins', 'plugins.json')
            const lock = new deps.rwlockfile.RWLockfile(lockRoot)
            return {
              root,
              ...p,
              lock,
            }
          })
      } catch (err) {
        cli.warn(err, { context: 'manifestPlugins' })
        return Rx.Observable.empty()
      }
    }

    return Rx.Observable.concat<PartialPlugin>(manifestPlugins(), corePlugins(), mainPlugin(), builtinPlugin())
      .map(async p => {
        const pjson = populatePJSON(await deps.readPkg(p.root))
        const debug = getDebug(p.type, pjson)
        if (p.name && p.name !== pjson.name) await handleNameChange(p, pjson)
        let plugin = { ...p, pjson, name: pjson.name, version: pjson.version, debug } as Plugin
        plugin.commandsDir = await fetchCommandsDir(plugin)
        return plugin
      })
      .concatMap(a => a.catch(err => cli.warn(err)))
      .filter((p): p is Plugin => !!p)
  }

  public async install(options) {
    // let name = options.type === 'user' ? options.name : await this.getLinkedPackageName(options.root)
    // let currentType = await this.pluginType(name)
    // if (currentType) {
    //   if (!options.force) {
    //     throw new Error(`${name} is already installed, run with --force to install anyway`)
    //   } else if (['link', 'user'].includes(currentType)) {
    //     await this.uninstall(name)
    //   }
    // }
    // if (options.type === 'link') {
    //   await this.link.install(options.root)
    // } else {
    //   await this.user.install(name, options.tag)
    // }
  }

  public async update(): Promise<void> {
    // await this.user.update()
  }

  public async uninstall(name: string): Promise<void> {
    // let user = await this.user.uninstall(name)
    // let link = await this.link.uninstall(name)
    // if (!user && !link) throw new Error(`${name} is not installed`)
    // cli.action.stop()
  }

  private get pluginCommands() {
    return this._pluginCommands || (this._pluginCommands = new deps.pluginCommands(this.config))
  }
  private get pluginTopics() {
    return this._pluginTopics || (this._pluginTopics = new deps.PluginTopics(this.config))
  }
}

function pkgRoot(initialRoot: string, name: string): string {
  function* updir() {
    for (let root = initialRoot; root !== '/'; root = path.dirname(root)) {
      yield root
    }
  }

  for (let root of updir()) {
    try {
      const p = require.resolve(path.join(root, 'node_modules', name, 'package.json'))
      if (p) return path.dirname(p)
    } catch (err) {
      if (err.code === 'MODULE_NOT_FOUND') continue
      throw err
    }
  }
  // this basically just throws the original error
  return require.resolve(path.join(initialRoot, 'node_modules', name, 'package.json'))
}

function populatePJSON(pjson: Package): IPluginPJSON {
  pjson['cli-engine'] = pjson['cli-engine'] || {}
  pjson['cli-engine'].topics = pjson['cli-engine'].topics || {}
  return pjson as IPluginPJSON
}

async function fetchCommandsDir(plugin: {
  pjson: IPluginPJSON
  root: string
  debug: Debug
}): Promise<string | undefined> {
  let commandsDir = plugin.pjson['cli-engine'].commands
  if (!commandsDir) return
  commandsDir = path.join(plugin.root, commandsDir)
  let tsconfig = await fetchTSConfig(plugin.root)
  if (tsconfig) {
    plugin.debug('tsconfig.json found')
    let { rootDir, outDir } = tsconfig.compilerOptions
    if (rootDir && outDir) {
      try {
        plugin.debug('using ts files')
        require('ts-node').register()
        const lib = path.join(plugin.root, outDir)
        const src = path.join(plugin.root, rootDir)
        const relative = path.relative(lib, commandsDir)
        commandsDir = path.join(src, relative)
      } catch (err) {
        plugin.debug(err)
      }
    }
  }
  return commandsDir
}

async function fetchTSConfig(root: string): Promise<TSConfig | undefined> {
  try {
    const tsconfig = await deps.file.readJSON(path.join(root, 'tsconfig.json'))
    return tsconfig.compilerOptions && tsconfig
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
}

async function handleNameChange(_: PartialPlugin, pjson: IPluginPJSON) {
  cli.warn(`name changed on ${pjson.name}`)
}
