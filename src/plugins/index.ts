import {ICommand, Config, Topic} from 'cli-engine-config'
import {Plugin} from './plugin'
// import LinkedPlugins from './linked'
// import UserPlugins from './user'
import CorePlugins from './core'
import {Cache, CachedCommand} from './cache'
import {CLI} from 'cli-ux'
import { Lock } from '../lock'
import _ from 'ts-lodash'

export default class Plugins {
  // linked: LinkedPlugins
  // user: UserPlugins
  core: CorePlugins
  plugins: Plugin[]
  cache: Cache
  lock: Lock
  loaded: boolean
  config: Config
  cli: CLI

  constructor (config: Config, cli?: CLI) {
    this.config = config
    this.cache = new Cache(config)
    this.cli = cli || new CLI({debug: !!config.debug, mock: config.mock, errlog: config.errlog})

    // this.builtin = new BuiltinPlugins(this)
    // this.linked = new LinkedPlugins(this)
    // this.user = new UserPlugins(this)
    this.core = new CorePlugins(this)
    this.lock = new Lock(this.config, this.cli)
  }

  async load () {
    if (this.loaded) return
    this.plugins = await this.cache.fetchManagers(
      // this.linked,
      // this.user,
      this.core,
      // this.builtin
    )
    this.loaded = true
  }

  get commands (): CachedCommand[] {
    let commands: CachedCommand[] = []
    for (let plugin of this.plugins) {
      try {
        commands = commands.concat(plugin.commands)
      } catch (err) {
        this.cli.warn(err, {context: `error reading plugin ${plugin.name}`})
      }
    }
    return commands
  }

  async list () {
    await this.load()
    return this.plugins
  }

  isPluginInstalled (name: string): boolean {
    return !!this.plugins.find(p => p.name === name)
  }

  async findPluginWithCommand (id: string): Promise<Plugin | undefined> {
    for (let plugin of await this.list()) {
      if (await plugin.findCommand(id)) return plugin
    }
  }

  async findCommand (id: string): Promise<ICommand | undefined> {
    for (let plugin of this.plugins) {
      let c = await plugin.findCommand(id)
      if (c) return c
    }
  }

  // async commandsForTopic (topic: string): Promise<ICommand[]> {
  //   let commands = this.plugins.reduce((t, p) => {
  //     try {
  //       return t.concat(p.commands
  //         .filter(c => c.topic === topic)
  //         .map(c => p.findCommand(c.id)))
  //     } catch (err) {
  //       this.cli.warn(err, {context: `error reading plugin ${p.name}`})
  //       return t
  //     }
  //   }, [] as ICommand[])
  //   commands = await Promise.all(commands)
  //   return _.uniqBy(commands, 'id')
  // }

  // async subtopicsForTopic (id: string): Promise<Topic[] | undefined> {
  //   for (let plugin of this.plugins) {
  //     let t = await plugin.findTopic(id)
  //     if (t) {
  //       return plugin.topics.filter(t => {
  //         if (!t.name) return false
  //         if (t.name === id) return false
  //         let re = new RegExp(`^${id}`)
  //         return !!(t.name).match(re)
  //       })
  //     }
  //   }
  // }

  async findTopic (id: string): Promise<Topic | undefined> {
    for (let plugin of this.plugins) {
      let t = await plugin.findTopic(id)
      if (t) return t
    }
  }

  // async install (name: string, tag: string = 'latest') {
  //   let downgrade = await this.lock.upgrade()

  //   await this.load()
  //   if (this.plugins.find(p => p.name === name && p.tag === tag)) throw new Error(`Plugin ${name} is already installed`)

  //   let path = await this.user.install(name, tag)
  //   this.clearCache(path)
  //   await downgrade()
  // }

  // async update () {
  //   if (this.user.list().length === 0) return
  //   this.cli.action.start(`${this.config.name}: Updating plugins`)
  //   let downgrade = await this.lock.upgrade()
  //   await this.user.update()
  //   this.clearCache(...(await this.user.list()).map(p => p.path))
  //   await downgrade()
  // }

  // async uninstall (name: string) {
  //   await this.load()
  //   let plugin = this.plugins.filter(p => ['user', 'link'].includes(p.type)).find(p => p.name === name)
  //   if (!plugin) throw new Error(`${name} is not installed`)
  //   let downgrade = await this.lock.upgrade()
  //   switch (plugin.type) {
  //     case 'user': {
  //       if (!this.config.debug) this.cli.action.start(`Uninstalling plugin ${name}`)
  //       await this.user.remove(name)
  //       break
  //     }
  //     case 'link': {
  //       if (!this.config.debug) this.cli.action.start(`Unlinking plugin ${name}`)
  //       this.linked.remove(plugin.path)
  //       break
  //     }
  //   }
  //   this.clearCache(plugin.path)
  //   await downgrade()
  //   this.cli.action.stop()
  // }

  // addPackageToPJSON (name: string, version: string = '*') {
  //   this.user.addPackageToPJSON(name, version)
  // }

  // async addLinkedPlugin (p: string) {
  //   let downgrade = await this.lock.upgrade()

  //   await this.load()
  //   await this.linked.add(p)
  //   this.clearCache(p)
  //   await downgrade()
  // }

  clearCache (...paths: string[]) {
    this.cache.deletePlugin(...paths)
  }

  get topics (): Topic[] {
    return _.uniqBy(this.plugins.reduce((t, p) => t.concat(p.topics), [] as Topic[]), 'id')
  }
}
