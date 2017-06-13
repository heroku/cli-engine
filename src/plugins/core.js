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
      let cli = this.config.pjson['cli-engine']
      if (!cli) return []
      return (cli.plugins || []).map(name => {
        return new PluginPath({output: this.out, type: 'core', path: path.join(this.config.root, 'node_modules', name)})
      })
    } catch (err) {
      this.out.warn(err, 'Error loading core plugins')
      return []
    }
  }
}
