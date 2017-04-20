// @flow

import {type Config} from 'cli-engine-config'
import Plugins from '../plugins'
import Plugin from './plugin'
import path from 'path'

export default class CorePlugins {
  constructor (plugins: Plugins) {
    this.plugins = plugins
    this.config = plugins.config
  }

  plugins: Plugins
  config: Config

  /**
   * list core plugins
   * @returns {Plugin[]}
   */
  get list (): Plugin[] {
    let cli = this.config.pjson['cli-engine']
    if (!cli) return []
    return (cli.plugins || []).map(name => {
      return new Plugin('core', path.join(this.config.root, 'node_modules', name), this.plugins)
    })
  }
}
