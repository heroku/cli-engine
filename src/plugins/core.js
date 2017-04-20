// @flow

import {type Config} from 'cli-engine-config'
import type Output from 'cli-engine-command/lib/output'
import {IPluginManager, PluginPath} from './plugin_manager'
import path from 'path'

export default class CorePlugins implements IPluginManager {
  constructor (out: Output) {
    this.out = out
    this.config = this.out.config
  }

  out: Output
  config: Config

  /**
   * list core plugins
   * @returns {PluginPath[]}
   */
  list (): PluginPath[] {
    let cli = this.config.pjson['cli-engine']
    if (!cli) return []
    return (cli.plugins || []).map(name => {
      return new PluginPath({output: this.out, type: 'core', path: path.join(this.config.root, 'node_modules', name)})
    })
  }
}
