// @flow

import Plugins from '../plugins'
import Plugin from './plugin'
import path from 'path'

export default class BuiltinPlugins {
  constructor (plugins: Plugins) {
    this.plugins = plugins
  }

  plugins: Plugins

  /**
   * list builtin plugins
   * @returns {Plugin[]}
   */
  get list (): Plugin[] {
    let commandsPath = path.resolve(path.join(__dirname, '..', 'commands'))
    return [new Plugin('builtin', commandsPath, this.plugins)]
  }
}
