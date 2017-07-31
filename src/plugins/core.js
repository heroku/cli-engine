// @flow

import {Manager, PluginPath} from './manager'
import path from 'path'

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
        plugins.push(new PluginPath({output: this.out, type: 'core', path: this.config.root)})
      }
      if (!cli) return plugins
      if (cli.plugins) {
        plugins = plugins.concat((cli.plugins || []).map(name => {
          return new PluginPath({output: this.out, type: 'core', path: path.join(this.config.root, 'node_modules', name)})
        }))
      }
      return plugins
    } catch (err) {
      this.out.warn(err, 'Error loading core plugins')
      return []
    }
  }
}
