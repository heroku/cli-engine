// @flow

import fs from 'fs-extra'
import path from 'path'
import {type Config} from 'cli-engine-config'

export default class {
  static _installLevel (namespace: ?string, config: Config): string {
    let namespaces = config.namespaces
    if (!namespace && !namespaces) namespace = namespaces = null
    if (namespaces && namespaces.includes(namespace)) {
      return 'namespace'
    } else {
      return 'root'
    }
  }

  static _readNamespace (pluginPath: string): ?string {
    try {
      let pjson = fs.readJSONSync(path.join(pluginPath, 'package.json'))
      return pjson['cli-engine'] ? pjson['cli-engine'].namespace : undefined
    } catch (err) {}
  }

  static metaData (pluginPath: string, config: Config): any {
    let pjsonNamespace = this._readNamespace(pluginPath)
    let installLevel = this._installLevel(pjsonNamespace, config)

    if (installLevel === 'not-permitted-for-install') installLevel = undefined
    let namespace = installLevel === 'namespace' ? pjsonNamespace : undefined

    return {
      installLevel,
      namespace,
      pjsonNamespace
    }
  }
}
