// @flow

import {Manager, PluginPath} from './manager'
import path from 'path'
import fs from 'fs-extra'

function pluginPath (root: string, name: string) {
  let p = path.join(root, 'node_modules', name)
  if (fs.existsSync(p)) return p
  let up = path.dirname(root)
  if (up === root) throw new Error(`Could not find core plugin ${name}`)
  return pluginPath(up, name)
}

export default class CorePlugins extends Manager {
  /**
   * list core plugins
   * @returns {PluginPath[]}
   */
  async list (): Promise<PluginPath[]> {
    try {
      const cli = this.config.pjson['cli-engine']
      let plugins = []
      if (this.config.pjson.main) {
        // if main is set in package.json, add plugin as self
        plugins.push(new PluginPath({config: this.config, type: 'core', path: this.config.root}))
      }
      if (!cli) return plugins
      if (cli.plugins) {
        plugins = plugins.concat((cli.plugins || []).map(name => {
          return new PluginPath({config: this.config, type: 'core', path: pluginPath(this.config.root, name)})
        }))
      }
      return plugins
    } catch (err) {
      this.cli.warn(err, 'Error loading core plugins')
      return []
    }
  }
}
