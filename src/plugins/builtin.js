// @flow

import type Output from 'cli-engine-command/lib/output'
import {IPluginManager, PluginPath} from './plugin_manager'
import path from 'path'

export default class BuiltinPlugins implements IPluginManager {
  constructor (out: Output) {
    this.out = out
  }

  out: Output

  /**
   * list builtin plugins
   * @returns {PluginPath[]}
   */
  list (): PluginPath[] {
    let commandsPath = path.resolve(path.join(__dirname, '..', 'commands'))
    return [new PluginPath({output: this.out, type: 'builtin', path: commandsPath})]
  }
}
