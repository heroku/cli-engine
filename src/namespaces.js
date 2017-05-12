import fs from 'fs-extra'
import path from 'path'
import {type Config} from 'cli-engine-config'

export default class {
  static get notPermittedError () {
    return new Error('Plugin\'s namespace not included in permittted namespaces')
  }

  static namespacePermitted (pluginPath: string, config: Config) : boolean {
    return ['root', 'namespace'].includes(this.pluginNamespaceLocation(pluginPath, config))
  }

  static pluginNamespaceLocation (pluginPath: string, config: Config) : ?string {
    let cliBin = config.bin
    let namespaces = config.namespaces
    let namespace = this.pluginNamespace(pluginPath)
    if (!namespace && !namespaces) namespace = namespaces = null
    if (cliBin === namespace || (!namespaces && !namespace)) {
      return 'root'
    } else if (namespaces && namespaces.includes(namespace)) {
      return 'namespace'
    } else {
      return undefined
    }
  }

  static pluginNamespace (pluginPath:string) : ?string {
    try {
      let pjson = fs.readJSONSync(path.join(pluginPath, 'package.json'))
      return pjson['cli-engine'] ? pjson['cli-engine'].namespace : undefined
    } catch (err) {
      return undefined
    }
  }

  static namespacePlugin (plugin: Object, pluginPath:string, config: Config) : ?Object {
    let pluginsLocation = this.pluginNamespaceLocation(pluginPath, config)
    if (pluginsLocation === 'root') return plugin
    if (pluginsLocation === 'namespace') {
      let namespace = this.pluginNamespace(pluginPath)
      return this._namespacePlugin(namespace, plugin)
    }
    // should not get to here
    throw new Error(`Plugin ${pluginPath} namespace not permitted and may be installed incorrectly`)
  }

  static _namespacePlugin (namespace: ?string, plugin: Object) : Object {
    if (!namespace) return plugin
    let nplugin = {namespace}
    nplugin.commands = plugin.commands.map(cmd => {
      return {
        topic: `${namespace}:${cmd.topic}`,
        command: cmd.command,
        description: cmd.description,
        run: cmd.run
      }
    })
    if (plugin.topic) {
      nplugin.topic = {
        topic: `${namespace}:${plugin.topic.name}`,
        description: plugin.topic.description,
        hidden: plugin.topic.hidden
      }
    }
    if (plugin.topics) {
      nplugin.topics = plugin.topics.map(topic => {
        return {
          topic: `${namespace}:${topic.name}`,
          description: topic.description,
          hidden: topic.hidden
        }
      })
    }
    return nplugin
  }
}
