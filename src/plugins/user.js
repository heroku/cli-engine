// @flow

import {type Config} from 'cli-engine-config'
import type Output from 'cli-engine-command/lib/output'
import type Cache from './cache'

import path from 'path'
import fs from 'fs-extra'

import {Manager, PluginPath, type PluginType} from './manager'
import Namespaces from '../namespaces'

import Yarn from './yarn'

type PJSON = {
  dependencies?: { [name: string]: string }
}

class UserPluginPath extends PluginPath {
  yarn: Yarn
  repairAttempted = false

  constructor ({output, type, path, tag, yarn}: {
    output: Output,
      type: PluginType,
      tag: string,
      path: string,
      yarn: Yarn
  }) {
    super({output, type, path, tag})
    this.yarn = yarn
  }

  async repair (err: Error): Promise<boolean> {
    if (err.code !== 'MODULE_NOT_FOUND') return false
    if (this.repairAttempted) return false
    this.out.action.start('Repairing plugins')
    this.repairAttempted = true
    await this.yarn.exec(['install', '--force'])
    this.out.action.stop()
    return true
  }
}

export default class UserPlugins extends Manager {
  constructor ({out, config, cache}: {out: Output, config: Config, cache: Cache}) {
    super({out, config, cache})
    this.yarn = new Yarn(this.out, this.userPluginsDir)
  }

  yarn: Yarn

  /**
   * list user plugins
   * @returns {PluginPath[]}
   */
  async list (): Promise<PluginPath[]> {
    try {
      const pjson = this.userPluginsPJSON
      return entries(pjson.dependencies || {}).map(([name, tag]) => {
        return new UserPluginPath({output: this.out, type: 'user', path: this.userPluginPath(name), tag: tag, yarn: this.yarn})
      })
    } catch (err) {
      this.out.warn(err, 'error loading user plugins')
      return []
    }
  }

  get userPluginsPJSON (): PJSON {
    try {
      return fs.readJSONSync(this.userPluginsPJSONPath)
    } catch (err) {
      return { dependencies: {} }
    }
  }

  saveUserPluginsPJSON (pjson: PJSON) {
    fs.writeJSONSync(path.join(this.userPluginsPJSONPath), pjson)
  }

  async setupUserPlugins () {
    const pjson = path.join(this.userPluginsDir, 'package.json')
    const yarnrc = path.join(this.userPluginsDir, '.yarnrc')
    fs.mkdirpSync(this.userPluginsDir)
    if (!fs.existsSync(pjson)) fs.writeFileSync(pjson, JSON.stringify({private: true}))
    if (!fs.existsSync(yarnrc)) fs.writeFileSync(yarnrc, 'registry "https://cli-npm.heroku.com/"')
  }

  async handleNodeVersionChange () {
    if (fs.existsSync(path.join(this.userPluginsDir, 'node_modules'))) {
      await this.yarn.exec(['install', '--force'])
    }
  }

  async install (name: string, tag: string = 'latest') {
    await this.setupUserPlugins()
    this.addPackageToPJSON(name, tag)
    try {
      await this.yarn.exec()
      let path = this.userPluginPath(name)
      Namespaces.throwErrorIfNotPermitted(path, this.config)
      // flow$ignore
      let plugin = require(path)
      if (!plugin.commands) throw new Error(`${name} does not appear to be a ${this.config.bin} CLI plugin`)
      return path
    } catch (err) {
      this.removePackageFromPJSON(name)
      this.out.error(err)
      throw new Error('unreachable')
    }
  }

  async update () {
    await this.setupUserPlugins()
    await this.yarn.exec(['upgrade'])
  }

  async remove (name: string) {
    await this.yarn.exec(['remove', name])
  }

  addPackageToPJSON (name: string, version: string = '*') {
    let pjson = this.userPluginsPJSON
    if (!pjson.dependencies) pjson.dependencies = {}
    pjson.dependencies[name] = version
    this.saveUserPluginsPJSON(pjson)
  }

  removePackageFromPJSON (name: string) {
    let pjson = this.userPluginsPJSON
    if (!pjson.dependencies) pjson.dependencies = {}
    delete pjson.dependencies[name]
    this.saveUserPluginsPJSON(pjson)
  }

  get userPluginsDir (): string { return path.join(this.config.dataDir, 'plugins') }

  get userPluginsPJSONPath (): string { return path.join(this.userPluginsDir, 'package.json') }

  userPluginPath (name: string): string { return path.join(this.userPluginsDir, 'node_modules', name) }
}

const entries = <T> (o: {[k: string]: T}): [string, T][] => Object.keys(o).map(k => [k, o[k]])
