import {Manager, PluginPath} from './manager'
import * as path from 'path'

export default class CorePlugins extends Manager {
  /**
   * list core plugins
   */
  async list (): Promise<PluginPath[]> {
    try {
      const cli = this.config.pjson['cli-engine']
      let plugins: PluginPath[] = []
      if (!cli) return plugins
      if (cli.plugins) {
        plugins = plugins.concat(cli.plugins.map(name => {
          return new PluginPath({config: this.config, type: 'core', path: path.join(this.config.root, 'node_modules', name)})
        }))
      }
      return plugins
    } catch (err) {
      this.cli.warn(err, {context: 'Error loading core plugins'})
      return []
    }
  }
}
