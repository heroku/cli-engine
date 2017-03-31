import type Config from 'cli-engine-command/lib/config'
import path from 'path'
import Plugin from './plugin'
import Plugins from './plugins'

export default class CorePlugins {
  constructor (plugins: Plugins) {
    this.config = plugins.config
  }

  plugins: Plugins
  config: Config

  /**
   * list linked plugins
   * @returns {Plugin[]}
   */
  list (): Plugin[] {
    return (this.config._cli.plugins || []).map(name => {
      return new Plugin('core', path.join(this.config.root, 'node_modules', name), this)
    })
  }
}
