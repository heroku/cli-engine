/* globals test expect beforeEach */

import Plugins from '../plugins'
import {tmpDirs} from '../../test/helpers'
import CLI from '../cli'

const path = require('path')
const fs = require('fs-extra')

jest.unmock('fs-extra')

jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000

let tmpDir
beforeEach(async () => {
  tmpDir = await tmpDirs()
})

afterEach(() => {
  tmpDir.clean()
})

test('user plugin should be cached', async () => {
  await tmpDir.plugins.install('heroku-debug', '4.0.0')

  let userPath = path.normalize(path.join(tmpDir.dataDir, 'plugins', 'node_modules', 'heroku-debug'))
  let pluginsJsonPath = path.join(tmpDir.cacheDir, 'plugins.json')

  let pluginsJson = fs.readJSONSync(pluginsJsonPath)
  expect(pluginsJson['plugins'][userPath]).toBeUndefined()

  let plugins = new Plugins(tmpDir.output)
  await plugins.load()
  let DebugUser = plugins.findCommand('debug')
  expect(DebugUser).toBeDefined()

  pluginsJson = fs.readJSONSync(pluginsJsonPath)
  let cached = pluginsJson['plugins'][userPath]
  expect(cached).toBeDefined()
  expect(cached['name']).toBe('heroku-debug')
  expect(cached['path']).toBe(userPath)

  await plugins.update()
  pluginsJson = fs.readJSONSync(pluginsJsonPath)
  expect(pluginsJson['plugins'][userPath]).toBeUndefined()

  plugins = new Plugins(tmpDir.output)
  await plugins.load()
  DebugUser = plugins.findCommand('debug')
  expect(DebugUser).toBeDefined()

  pluginsJson = fs.readJSONSync(pluginsJsonPath)
  expect(pluginsJson['plugins'][userPath]).toBeDefined()

  await plugins.uninstall('heroku-debug')

  pluginsJson = fs.readJSONSync(pluginsJsonPath)
  expect(pluginsJson['plugins'][userPath]).toBeUndefined()
})

test('plugins should be reloaded when node_version null', async () => {
  await tmpDir.plugins.install('heroku-hello-world-build', '0.0.0')

  let dataDir = tmpDir.dataDir
  let plugins = path.join(dataDir, 'plugins')

  // remove the cache that tmpDirs creates
  let pluginsJsonPath = path.join(tmpDir.cacheDir, 'plugins.json')
  fs.removeSync(pluginsJsonPath)

  fs.removeSync(path.join(plugins, 'package.json'))
  fs.removeSync(path.join(plugins, 'yarn.lock'))

  // attempt to emulate a build mismatch by removing build from snappy
  let buildDir = path.join(plugins, 'node_modules', 'heroku-hello-world-build', 'build')
  fs.removeSync(buildDir)

  // drop in v5 plugins.json
  let json = [{name: 'heroku-hello-world-build'}]
  fs.writeJSONSync(path.join(dataDir, 'plugins', 'plugins.json'), json)

  let cli = new CLI({argv: ['cli', 'hello'], mock: true, config: tmpDir.config})
  try {
    await cli.run()
  } catch (err) {
    if (err.code !== 0) throw err
  }

  let pluginsJson = fs.readJSONSync(pluginsJsonPath)
  expect(pluginsJson['node_version']).toEqual(process.version)
})

test('plugins should be reloaded when node_version changed', async () => {
  await tmpDir.plugins.install('heroku-hello-world-build', '0.0.0')

  let dataDir = tmpDir.dataDir
  let plugins = path.join(dataDir, 'plugins')

  let pluginsJsonPath = path.join(tmpDir.cacheDir, 'plugins.json')

  // emulate an old version of node
  let pluginsJson = fs.readJSONSync(pluginsJsonPath)
  pluginsJson['node_version'] = '1.0.0'
  fs.writeJSONSync(pluginsJsonPath, pluginsJson)

  // attempt to emulate a build mismatch by removing build from snappy
  let buildDir = path.join(plugins, 'node_modules', 'heroku-hello-world-build', 'build')
  fs.removeSync(buildDir)

  let cli = new CLI({argv: ['cli', 'hello'], mock: true, config: tmpDir.config})
  try {
    await cli.run()
  } catch (err) {
    if (err.code !== 0) throw err
  }

  pluginsJson = fs.readJSONSync(pluginsJsonPath)
  expect(pluginsJson['node_version']).toEqual(process.version)
})
