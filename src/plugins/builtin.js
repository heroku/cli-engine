// @flow

import {Manager, PluginPath} from './manager'
import path from 'path'

export default class BuiltinPlugins extends Manager {
  /**
   * list builtin plugins
   * @returns {PluginPath[]}
   */
  async list (): Promise<PluginPath[]> {
    let commandsPath = path.resolve(path.join(__dirname, '..', 'commands'))
    return [new PluginPath({config: this.config, type: 'builtin', path: commandsPath})]
  }
}
