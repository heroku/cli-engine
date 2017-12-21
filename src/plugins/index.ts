import { IConfig } from 'cli-engine-config'
import { ICommand } from 'cli-engine-config'
import cli from 'cli-ux'
import * as path from 'path'
import _ from 'ts-lodash'
import deps from '../deps'
import { Lock } from '../lock'
import { Builtin } from './builtin'
import { CorePlugins } from './core'
import { LinkPlugins } from './link'
import { PluginManager } from './manager'
import { Plugin, PluginType } from './plugin'
import { UserPlugins } from './user'
import {LoadResult, Topic} from '../topic'
import {CommandInfo} from '../command'

export type InstallOptions = ILinkInstallOptions | IUserInstallOptions
export interface IUserInstallOptions {
  type: 'user'
  name: string
  tag: string
  force?: boolean
}
export interface ILinkInstallOptions {
  type: 'link'
  root: string
  force?: boolean
}

interface IXPlugin {
}

interface IXLoadResult {
  topics?: {[k: string]: Topic}
  commands?: {[k: string]: CommandInfo}
}

interface IXCommandManager {
  submanagers? (): Promise<IXCommandManager[]>
  needsRefresh? (): Promise<boolean>
  refresh? (): Promise<void>
  load (): Promise<IXLoadResult>
}

abstract class XPlugin {
}

class XUserPlugin extends XPlugin {
  constructor (protected config: IConfig, protected opts: {name: string}) {
    super()
  }
  public async load () {
    return {
      topics: {
        foo: new Topic({name: this.opts.name})
      }
    }
  }
}

class XUserPluginManager implements IXCommandManager {
  constructor (protected config: IConfig) {}

  public async submanagers () {
    return [
      new XUserPlugin(this.config, {name: 'fooobarbaz'})
    ]
  }

  public async load () {
    return {
      topics: {
        bar: new Topic({name: 'bar'})
      }
    }
  }
}

class XBuiltinPlugin implements IXPlugin {
  constructor (protected config: IConfig) {}
  public async load () {
    return {
      topics: {
        builtin: new Topic({name: 'builtin'})
      }
    }
  }
}

interface IXPluginManager {
  load: () => Promise<IXPlugin[]>
}

class XPluginManager {
  private debug = require('debug')('cli:plugins')

  constructor (protected config: IConfig) {}

  public async submanagers() {
    return [
      new XBuiltinPlugin(this.config),
      new XUserPluginManager(this.config),
    ]
  }

  public async load (): Promise<LoadResult> {
    this.debug('load')
    let managers = await this.allManagers()
    let managersToRefresh = await this.managersNeedingRefresh(managers)
    if (managersToRefresh.length) await this.refresh(managersToRefresh)
    let result
    this.debug('loading all managers')
    let loads = managers.map(m => m.load())
    for (let r of loads) result = this.mergeResults(result, await r)
    return result!
  }

  public async refresh (managers: IXCommandManager[]) {
    this.debug('get write lock')
    let tasks = managers.map(m => m.refresh!())
    for (let t of tasks) await t
    this.debug('release write lock')
  }

  private async allManagers (manager: this | IXCommandManager = this): Promise<IXCommandManager[]> {
    this.debug('fetching managers')
    let managers: IXCommandManager[] = manager.submanagers ? await manager.submanagers() : []
    for (let m of managers.map(m => this.allManagers(m))) {
      managers = managers.concat(await m)
    }
    return managers
  }

  private async managersNeedingRefresh (managers: IXCommandManager[]): Promise<IXCommandManager[]> {
    this.debug('checking which managers need refreshes')
    let tasks = managers
      .filter(m => m.needsRefresh)
      .map(manager => ({manager, needsRefresh: manager.needsRefresh!()}))
    let out = []
    for (let task of tasks) {
      if (!await task.needsRefresh) continue
      out.push(task.manager)
    }
    return out
  }

  private mergeResults (a: LoadResult | undefined, b: IXLoadResult): LoadResult {
    a = a || new LoadResult()
    if (b.topics) a.addTopics(b.topics)
    if (b.commands) a.addTopics(b.commands)
    return a
  }
}

class XBuiltinCommands {
  constructor (private config: IConfig) {}
  public async load () {
    console.dir('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
    let m = new XPluginManager(this.config)
    let r = await m.load()
    console.dir(r)
    console.dir('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
    process.exit(1)
  }
}

export class Plugins extends PluginManager {
  public builtin: Builtin
  public core: CorePlugins
  public user: UserPlugins
  public link: LinkPlugins
  protected debug = require('debug')('cli:plugins')
  private lock: Lock

  constructor({ config }: { config: IConfig }) {
    super({ config })
    this.lock = new deps.Lock(config, path.join(config.cacheDir, 'plugins.lock'))
  }

  public async install(options: InstallOptions) {
    let downgrade = await this.lock.upgrade()
    let name = options.type === 'user' ? options.name : await this.getLinkedPackageName(options.root)
    if (!options.force && (await this.pluginType(name))) {
      throw new Error(`${name} is already installed. Run with --force to install anyway`)
    }
    if (options.type === 'link') {
      await this.link.install(options.root)
      await this.manifest.add({ type: options.type, name, root: options.root })
    } else {
      await this.user.install(name, options.tag)
      await this.manifest.add({ type: options.type, name, tag: options.tag })
    }
    await this.save()
    await downgrade()
  }

  public async update(): Promise<void> {
    let downgrade = await this.lock.upgrade()
    await this.migrate()
    await this.user.update()
    await this.save()
    await downgrade()
  }

  public async uninstall(name: string): Promise<void> {
    await this.init()
    let downgrade = await this.lock.upgrade()
    const type = await this.pluginType(name)
    if (!type) {
      const linked = await this.link.findByRoot(name)
      if (linked) {
        name = linked.name
      } else throw new Error(`${name} is not installed`)
    }
    await this.manifest.remove(name)
    await this.save()
    if (type === 'user') await this.user.uninstall(name)
    await downgrade()
  }

  public async init() {
    await super.init()
    if (await this.needsRefresh) {
      let downgrade = await this.lock.upgrade()
      cli.action.start('Refreshing plugins')
      await this.refresh()
      await this.load
      await this.save()
      cli.action.stop()
      await downgrade()
    }
    await this.load
  }

  public async findCommand(id: string, options: { must: true }): Promise<ICommand>
  public async findCommand(id: string, options?: { must?: boolean }): Promise<ICommand | undefined>
  public async findCommand(id: string, options: { must?: boolean } = {}): Promise<ICommand | undefined> {
    const b = new XBuiltinCommands(this.config)
    await b.load()
    const cmd = await super.findCommand(id)
    if (!cmd && options.must) throw new Error(`${id} not found`)
    return cmd
  }

  protected async _init() {
    const submanagerOpts = { config: this.config, manifest: this.manifest, cache: this.cache, lock: this.lock }
    this.builtin = new deps.Builtin(submanagerOpts)
    this.submanagers.push(this.builtin)
    try {
      this.core = new deps.CorePlugins(submanagerOpts)
    } catch (err) {
      cli.warn(err, { context: 'core plugins' })
    }
    if (this.config.userPlugins) {
      try {
        this.user = new deps.UserPlugins(submanagerOpts)
        this.link = new deps.LinkPlugins(submanagerOpts)
      } catch (err) {
        cli.warn(err, { context: 'user/link plugins' })
      }
    }
    this.submanagers = _.compact([this.link, this.user, this.core, this.builtin])
  }

  public get plugins(): Plugin[] {
    const managers = _.compact([this.link, this.user, this.core])
    const plugins = managers.reduce((o, i) => o.concat(i.plugins), [] as Plugin[])
    return _.compact([...plugins, this.builtin])
  }

  private async save() {
    try {
      await this.manifest.save()
      await this.cache.save()
    } catch (err) {
      cli.warn(err)
    }
  }

  private async migrate() {
    const migrate = new deps.PluginsMigrate({
      config: this.config,
      manifest: this.manifest,
    })
    await migrate.migrate()
  }

  private async getLinkedPackageName(root: string): Promise<string> {
    const pjson = await deps.file.fetchJSONFile(path.join(root, 'package.json'))
    return pjson.name
  }

  private pluginType(name: string): PluginType | undefined {
    const plugin = this.plugins.find(p => p.name === name)
    return plugin && plugin.type
  }
}
