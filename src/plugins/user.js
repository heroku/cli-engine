// @flow

import {type Config} from 'cli-engine-config'
import type Output from 'cli-engine-command/lib/output'

import path from 'path'
import lock from 'rwlockfile'
import fs from 'fs-extra'

import {Manager, PluginPath} from './manager'
import Namespaces from '../namespaces'

import Yarn from './yarn'
import NPM from './npm'

type PJSON = {
  dependencies?: { [name: string]: string }
}

export default class UserPlugins extends Manager {
  constructor ({out, config}: {out: Output, config: Config}) {
    super({out, config})
    this.yarn = new Yarn(this.out, this.userPluginsDir)
  }

  yarn: Yarn

  /**
   * list user plugins
   * @returns {PluginPath[]}
   */
  list (): PluginPath[] {
    const pjson = this.userPluginsPJSON
    return entries(pjson.dependencies || {}).map(([name, tag]) => {
      return new PluginPath({output: this.out, type: 'user', path: this.userPluginPath(name), tag: tag})
    })
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
    await this.yarn.exec()
  }

  async handleNodeVersionChange () {
    // very important, if the node_modules does not exist, it runs back
    // up the directory tree looking for node_modules to build
    if (fs.existsSync(path.join(this.userPluginsDir, 'node_modules'))) {
      let npm = new NPM(this.out, this.userPluginsDir)
      await npm.exec(['rebuild'])
    }
  }

  async install (name: string, tag: string = 'latest') {
    let unlock = await lock.write(this.lockfile, {skipOwnPid: true})
    await this.setupUserPlugins()
    this.addPackageToPJSON(name, tag)
    try {
      await this.yarn.exec()
      let path = this.userPluginPath(name)
      if (!Namespaces.namespacePermitted(path, this.config)) throw Namespaces.notPermittedError
      // flow$ignore
      let plugin = require(path)
      if (!plugin.commands) throw new Error(`${name} does not appear to be a ${this.config.bin} CLI plugin`)
      await unlock()
      return path
    } catch (err) {
      await unlock()
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
    let unlock = await lock.write(this.lockfile, {skipOwnPid: true})
    await this.yarn.exec(['remove', name])
    await unlock()
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

  get lockfile (): string { return path.join(this.config.cacheDir, 'plugins.lock') }
}

const entries = <T> (o: {[k: string]: T}): [string, T][] => Object.keys(o).map(k => [k, o[k]])
