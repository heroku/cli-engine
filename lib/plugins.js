const dirs = require('./dirs')
const path = require('path')
const fs = require('fs-extra')
const klaw = require('klaw-sync')
const config = require('./config')
const errors = require('./errors')
const util = require('./util')

function userPlugins () {
  try {
    let pjson = fs.readJSONSync(path.join(dirs.plugins, 'package.json'))
    return Object.keys(pjson.dependencies)
  } catch (err) {
    if (err.code === 'ENOENT') return []
    throw err
  }
}

exports.commandList = []
exports.commands = {}
exports.topics = {}

let cache = {version: config.version, plugins: {}}
let cacheUpdated = false
let cacheFile = path.join(dirs.cache, 'plugins.json')
try {
  cache = fs.readJSONSync(cacheFile)
  if (cache.version !== config.version) cache = {version: config.version, plugins: {}}
} catch (err) {
  if (err.code !== 'ENOENT') throw err
}
function savePluginCache () {
  fs.writeJSONSync(cacheFile, cache)
}

let linkedPlugins = {plugins: {}}
try {
  linkedPlugins = fs.readJSONSync(dirs.linkedPlugins)
} catch (err) {
  if (err.code !== 'ENOENT') throw err
}

function registerPlugin (type, parent) {
  return plugin => {
    const r = parent ? m => parent.require(m) : m => require(m)

    function linkedPluginOutdated (plugin) {
      const max = require('lodash.maxby')
      let files = klaw(plugin, {nodir: true, ignore: ['.git', 'node_modules']})
      const cur = new Date(max(files, 'stats.mtime').stats.mtime)
      const last = new Date(cache.plugins[plugin].updated_at)
      return cur > last
    }

    function requirePlugin (plugin) {
      if (!cache.plugins[plugin] ||
        (type === 'linked' && linkedPluginOutdated(plugin)) ||
        (process.env.HEROKU_DEV === '1' && ['builtin', 'core'].includes(type))) {
        let info = r(plugin)
        let topics = info.topics ? info.topics : (info.topic ? [info.topic] : [])
        let pjson = type === 'builtin'
          ? {}
          : r(path.join(plugin, 'package.json'))
        cache.plugins[plugin] = {
          plugin,
          version: pjson.version,
          name: pjson.name,
          type,
          updated_at: new Date(),
          topics: topics.map(t => ({
            topic: t.topic || t.name,
            description: t.description,
            hidden: t.hidden
          })),
          commands: info.commands.map(c => ({
            topic: c.topic,
            command: c.command,
            description: c.description,
            args: c.args,
            flags: c.flags,
            help: c.help,
            aliases: c.aliases,
            usage: c.usage,
            hidden: c.hidden
          }))
        }
        cacheUpdated = true
      }
      cache.plugins[plugin].fetch = () => r(plugin)
      for (let t of cache.plugins[plugin].topics) t.fetch = () => (r(plugin).topics || [r(plugin).topic]).find(r => r.topic === t.topic)
      for (let c of cache.plugins[plugin].commands) c.fetch = () => r(plugin).commands.find(r => r.topic === c.topic && r.command === c.command)
      return cache.plugins[plugin]
    }

    function registerTopic (topic) {
      let name = topic.topic || topic.name
      let current = exports.topics[name]
      if (current) {
        current.description = current.description || topic.description
      } else {
        exports.topics[name] = topic
      }
    }

    function registerCommand (command) {
      if (!command.topic) return
      exports.commandList.push(command)
      let names = command.command ? [`${command.topic}:${command.command}`] : [command.topic]
      names = names.concat(command.aliases || [])
      if (command.default) names.push(command.topic)
      for (let name of names) {
        if (exports.commands[name]) console.error(`WARNING: command ${name} is already defined`)
        exports.commands[name] = command
      }
    }

    try {
      plugin = requirePlugin(plugin)
      if (plugin.topics) plugin.topics.forEach(registerTopic)
      plugin.commands.forEach(registerCommand)
    } catch (err) {
      console.error(`Error reading plugin: ${plugin}`)
      console.error(err)
      errors.logError(err)
    }
  }
}

registerPlugin('builtin')('../commands')
let core = config.plugins || []
if (core) core.forEach(registerPlugin('core', config.parent))
userPlugins().map(p => path.join(dirs.plugins, 'node_modules', p)).forEach(registerPlugin('user'))
Object.keys(linkedPlugins.plugins).map(k => linkedPlugins.plugins[k]).forEach(registerPlugin('linked'))

exports.commandList.sort(util.compare('topic', 'command'))
if (cacheUpdated) savePluginCache()

exports.clearCache = plugin => {
  delete cache.plugins[plugin]
  savePluginCache()
}

exports.list = () => {
  return Object.keys(cache.plugins).map(p => cache.plugins[p])
}

exports.addLinkedPlugin = plugin => {
  let p = require(path.join(plugin, 'package.json'))
  linkedPlugins.plugins[p.name] = plugin
  fs.writeJSONSync(dirs.linkedPlugins, linkedPlugins)
  exports.clearCache(plugin)
}

exports.removeLinkedPlugin = plugin => {
  let p = linkedPlugins.plugins[plugin]
  if (!p) throw new Error(`${plugin} is not installed`)
  delete linkedPlugins.plugins[plugin]
  fs.writeJSONSync(dirs.linkedPlugins, linkedPlugins)
  exports.clearCache(p)
}
