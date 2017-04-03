// @flow

import type Config from 'cli-engine-command/lib/config'
import type Output from 'cli-engine-command/lib/output'
import path from 'path'
import Plugin from './plugin'
import Plugins from './plugins'
import fs from 'fs-extra'

type PJSON = {
  dependencies?: { [name: string]: string }
}

export default class UserPlugins {
  constructor (plugins: Plugins) {
    this.out = plugins.out
    this.plugins = plugins
    this.config = this.plugins.config
    const pjson = this.userPluginsPJSON
    this._list = Object.keys(pjson.dependencies || {}).map(name => {
      return new Plugin('user', this.userPluginPath(name), this.plugins)
    })
  }

  _list: Plugin[]
  plugins: Plugins
  config: Config
  out: Output

  async pluginsUpdate () {
    for (let plugin of this.list()) {
      this.out.action.start(`${this.config.name}: Updating plugin ${plugin.name}`)
      let version = await this.plugins.needsUpdate(plugin.name)
      if (!version) continue
      this.out.action.start(`${this.config.name}: Updating plugin ${plugin.name} to ${version}`)
      await this.plugins.update(plugin.name, version)
      this.out.action.stop()
    }
  }

  list (): Plugin[] {
    return this._list
  }

  get userPluginsPJSON (): PJSON {
    try {
      return fs.readJSONSync(path.join(this.userPluginsDir, 'package.json'))
    } catch (err) {
      return { dependencies: {} }
    }
  }

  get userPluginsDir (): string { return path.join(this.config.dirs.data, 'plugins') }
  userPluginPath (name: string): string { return path.join(this.userPluginsDir, 'node_modules', name) }
}
