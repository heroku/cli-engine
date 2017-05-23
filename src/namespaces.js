import fs from 'fs-extra'
import path from 'path'
import {type Config} from 'cli-engine-config'

export default class {
  static get notPermittedError () {
    return new Error('Plugin\'s namespace not included in permitted namespaces')
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
      // prevents `foo:foo:command` on multiple `require()` calls
      let topic = plugin.topic || plugin.topics[0]
      if ((topic.name || topic.topic).split(':')[0] === namespace) return plugin
      return this._prependNamespace(namespace, plugin)
    }
    // should not get to here
    throw new Error(`Plugin ${pluginPath} namespace not permitted and may be installed incorrectly`)
  }

  static _prependNamespace (namespace: string, plugin: Object) : Object {
    if (plugin.topic && !plugin.topics) plugin.topics = [plugin.topic]
    let namespaced = {
      namespace,
      commands: plugin.commands.map(cmd => {
        return Object.assign(cmd, {topic: `${namespace}:${cmd.topic}`})
      }),
      topics: plugin.topics.map(topic => {
        let name = `${namespace}:${topic.name || topic.topic}`
        return Object.assign(topic, {name, topic: name})
      })
    }
    return namespaced
  }
}
