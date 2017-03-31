import type Config from 'cli-engine-command/lib/config'
import path from 'path'
import Plugin from './plugin'
import Plugins from './plugins'
import fs from 'fs-extra'

type PJSON = {
  dependencies?: { [name: string]: string }
}

export default class UserPlugins {
  constructor (plugins: Plugins) {
    this.plugins = plugins
    this.config = this.plugins.config
  }

  plugins: Plugins
  config: Config

  list (): Plugin[] {
    const pjson = this.userPluginsPJSON
    return Object.keys(pjson.dependencies || {}).map(name => {
      return new Plugin('user', this.userPluginPath(name), this.plugins)
    })
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
