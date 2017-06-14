// @flow

import fs from 'fs-extra'
import path from 'path'
import {type Config} from 'cli-engine-config'

export default class {
  static get notPermittedError () {
    return new Error('Plugin\'s namespace not included in permitted namespaces')
  }

  static throwErrorIfNotPermitted (pluginPath: string, config: Config) {
    if (this._permitted(pluginPath, config)) return
    throw this.notPermittedError
  }

  static _permitted (pluginPath: string, config: Config): boolean {
    let namespace = this._readNamespace(pluginPath)
    return ['root', 'namespace'].includes(this._installLevel(namespace, config))
  }

  static _installLevel (namespace: ?string, config: Config): string {
    let cliBin = config.bin
    let namespaces = config.namespaces
    if (!namespace && !namespaces) namespace = namespaces = null
    if (cliBin === namespace || (!namespaces && !namespace)) {
      return 'root'
    } else if (namespaces && namespaces.includes(namespace)) {
      return 'namespace'
    }
    return 'undefined'
  }

  static _readNamespace (pluginPath: string): ?string {
    try {
      let pjson = fs.readJSONSync(path.join(pluginPath, 'package.json'))
      return pjson['cli-engine'] ? pjson['cli-engine'].namespace : undefined
    } catch (err) {}
  }

  static metaData (pluginPath: string, config: Config): any {
    let pjsonNamespace = this._readNamespace(pluginPath)
    let permitted = this._permitted(pluginPath, config)
    let installLevel = this._installLevel(pjsonNamespace, config)

    return {
      permitted,
      installLevel,
      namespace: (permitted && installLevel === 'namespace') ? pjsonNamespace : undefined,
      pjsonNamespace
    }
  }
}
