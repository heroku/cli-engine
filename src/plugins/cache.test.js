// @flow

import Cache from './cache'
import Output from 'cli-engine-command/lib/output'
import path from 'path'
import fs from 'fs-extra'

const cacheDir = path.join(__dirname, '..', 'tmp', 'cache')
const pluginsCachePath = path.join(cacheDir, 'plugins.json')
const config = {cacheDir}
const output = new Output({config})
beforeEach(() => {
  fs.mkdirpSync(cacheDir)
  fs.removeSync(pluginsCachePath)
})

const myplugin = {name: 'myplugin', path: 'myplugin', version: '1.0.0', topics: [], commands: []}

test('new Cache(output)', () => {
  let cache = new Cache(output)
  expect(cache.cache.node_version).toBeNull()
})

test('updatePlugin', () => {
  let cache = new Cache(output)
  cache.updatePlugin('myplugin', myplugin)
  cache.save()
  let cache2 = new Cache(output)
  const plugin = cache2.plugin('myplugin')
  if (!plugin) throw new Error()
  expect(plugin.version).toEqual('1.0.0')
})

test('deletePlugin', () => {
  let cache = new Cache(output)
  cache.updatePlugin('myplugin', myplugin)
  expect(cache.plugin('myplugin')).toBeDefined()
  cache.deletePlugin('myplugin')
  expect(cache.plugin('myplugin')).toBeUndefined()
})
