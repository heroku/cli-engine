// @flow

import {Manager, PluginPath} from './manager'
import path from 'path'

export default class BuiltinPlugins extends Manager {
  /**
   * list builtin plugins
   * @returns {PluginPath[]}
   */
  list (): PluginPath[] {
    let commandsPath = path.resolve(path.join(__dirname, '..', 'commands'))
    return [new PluginPath({output: this.out, type: 'builtin', path: commandsPath})]
  }
}
