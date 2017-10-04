// @flow

import type {Config} from 'cli-engine-config'
import type Cache from './cache'
import {Hooks} from '../hooks'

import path from 'path'
import fs from 'fs-extra'

import {Manager, PluginPath, type PluginType} from './manager'

import Yarn from './yarn'

type PJSON = {
  dependencies?: { [name: string]: string }
}

class UserPluginPath extends PluginPath {
  userPlugins: UserPlugins
  repairAttempted = false

  constructor ({config, type, path, tag, userPlugins}: {
    config: Config,
      type: PluginType,
      tag: string,
      path: string,
      userPlugins: UserPlugins
  }) {
    super({config, type, path, tag})
    this.userPlugins = userPlugins
  }

  async repair (err: Error): Promise<boolean> {
    if (err.code !== 'MODULE_NOT_FOUND') return false
    if (this.repairAttempted) return false
    this.cli.warn(err)
    this.cli.action.start(`Repairing plugin ${this.path}`)
    this.repairAttempted = true

    await this.userPlugins.installForce()
    this.cli.action.stop()
    return true
  }
}

export default class UserPlugins extends Manager {
  hooks: Hooks
  hardcodedDepFixes: Object

  constructor ({config, cache}: {config: Config, cache: Cache}) {
    super({config, cache})
    this.yarn = new Yarn(this.config, this.userPluginsDir)
    this.hooks = new Hooks({config})

    /**
     * There is a bug with snappy & node-gyp & semver that causes issues when
     * we rebuild.  What happens is that semver is downgraded from 5.3.0 to
     * 4.3.2 which has a bug in it that causes node-gyp to fail
     *
     * I was going to try and make this an add to package.json to save some
     * time but that causes 4.3.2 to install into node-gyp/node_modules for
     * reasons I do not understand but `add` does the right thing
     *
     * I set version to ~5.3.0 to match the current dependency from node-gyp
     * under the assumption that it is the most likely to work properly
     *
     * https://github.com/nodejs/node-gyp/blob/75cfae290fee1791a23fa68820ae5dd841e93e14/package.json#L34
     */
    this.hardcodedDepFixes = {
      semver: '~5.3.0'
    }
  }

  yarn: Yarn

  /**
   * list user plugins
   * @returns {PluginPath[]}
   */
  async list (): Promise<PluginPath[]> {
    try {
      const pjson = this.userPluginsPJSON
      return entries(pjson.dependencies || {})
        .filter(([name, tag]) => {
          return !this.hardcodedDepFixes[name]
        })
        .map(([name, tag]) => {
          return new UserPluginPath({config: this.config, type: 'user', path: this.userPluginPath(name), tag: tag, userPlugins: this})
        })
    } catch (err) {
      this.cli.warn(err, 'error loading user plugins')
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

  async installForce () {
    if (fs.existsSync(path.join(this.userPluginsDir, 'node_modules'))) {
      let dependencies = this.userPluginsPJSON['dependencies'] || {}
      for (let mod in this.hardcodedDepFixes) {
        if (!dependencies[mod]) {
          await this.yarn.exec(['add', `${mod}@${this.hardcodedDepFixes[mod]}`])
        }
      }
      await this.yarn.exec(['install', '--force'])
    }
  }

  async handleNodeVersionChange () {
    try {
      await this.installForce()
    } catch (err) {
      this.cli.warn(err)
    }
  }

  async install (name: string, tag: string = 'latest') {
    await this.hooks.run('plugins:preinstall', {plugin: name, tag})
    await this.setupUserPlugins()
    this.addPackageToPJSON(name, tag)
    try {
      await this.yarn.exec()
      let path = this.userPluginPath(name)
      let plugin = require(path)
      if (!plugin.commands) throw new Error(`${name} does not appear to be a ${this.config.bin} CLI plugin`)
      return path
    } catch (err) {
      this.removePackageFromPJSON(name)
      this.cli.error(err)
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
