/* globals test expect beforeEach */

import Plugins from '../plugins'
import {tmpDirs} from '../../test/helpers'
import CLI from '../cli'
import Yarn from './yarn'

const path = require('path')
const fs = require('fs-extra')

jest.unmock('fs-extra')

jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000

let tmpDir
beforeEach(async () => {
  tmpDir = await tmpDirs()
})

afterEach(() => {
  tmpDir.clean()
})

test.skip('user plugin should be cached', async () => {
  await tmpDir.plugins.install('cli-engine-stub-plugin', '1.0.4')

  let userPath = path.normalize(path.join(tmpDir.dataDir, 'plugins', 'node_modules', 'cli-engine-stub-plugin'))
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
  expect(cached['name']).toBe('cli-engine-stub-plugin')
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

  await plugins.uninstall('cli-engine-stub-plugin')

  pluginsJson = fs.readJSONSync(pluginsJsonPath)
  expect(pluginsJson['plugins'][userPath]).toBeUndefined()
})

test.skip('plugins should be reloaded when node_version null', async () => {
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

  await tmpDir.plugins.update()

  let config = {
    ...tmpDir.config,
    argv: ['cli', 'hello'],
    mock: true
  }
  let cli = new CLI({config})
  try {
    await cli.run()
  } catch (err) {
    if (err.code !== 0) throw err
  }

  let pluginsJson = fs.readJSONSync(pluginsJsonPath)
  expect(pluginsJson['node_version']).toEqual(process.version)
})

test.skip('plugins should be reloaded when node_version changed', async () => {
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

  let config = {
    ...tmpDir.config,
    argv: ['cli', 'hello'],
    mock: true
  }
  let cli = new CLI({config})
  try {
    await cli.run()
  } catch (err) {
    if (err.code !== 0) throw err
  }

  pluginsJson = fs.readJSONSync(pluginsJsonPath)
  expect(pluginsJson['node_version']).toEqual(process.version)
})

test.skip('problematic version of semver should be overwritten', async () => {
  if (tmpDir.config.windows) return // cannot remove snappy dir when loaded

  await tmpDir.plugins.install('heroku-kafka', '2.9.8')
  await tmpDir.plugins.install('heroku-pg-extras', '1.0.11')

  // remove the cache that tmpDirs creates
  let pluginsJsonPath = path.join(tmpDir.cacheDir, 'plugins.json')
  fs.removeSync(pluginsJsonPath)

  let snappyBuild = path.join(tmpDir.dataDir, 'plugins', 'node_modules', 'snappy', 'build')
  fs.removeSync(snappyBuild)

  let plugins = new Plugins(tmpDir.output)
  await plugins.load()

  let semverPath = path.join(tmpDir.dataDir, 'plugins', 'node_modules', 'semver')
  let pluginsList = await plugins.list()

  let semverPlugin = pluginsList.find((plugin) => plugin.path === semverPath)
  expect(semverPlugin).toBeUndefined()

  let pluginsJson = fs.readJSONSync(pluginsJsonPath)
  expect(pluginsJson['node_version']).toEqual(process.version)

  expect(fs.existsSync(snappyBuild)).toEqual(true)
})

test.skip('problematic version of semver from previous release should be overwritten', async () => {
  if (tmpDir.config.windows) return // cannot remove snappy dir when loaded

  await tmpDir.plugins.install('heroku-kafka', '2.9.8')
  await tmpDir.plugins.install('heroku-pg-extras', '1.0.11')

  // remove the cache that tmpDirs creates
  let pluginsJsonPath = path.join(tmpDir.cacheDir, 'plugins.json')
  fs.removeSync(pluginsJsonPath)

  let pluginsDir = tmpDir.plugins.user.userPluginsDir
  let yarn = new Yarn(tmpDir.output, pluginsDir)

  try {
    // put our installation in the same state as the failed updates
    await yarn.exec(['install', '--force'])
  } catch (err) {}

  let snappyBuild = path.join(pluginsDir, 'node_modules', 'snappy', 'build')
  fs.removeSync(snappyBuild)

  let plugins = new Plugins(tmpDir.output)
  await plugins.load()

  let pluginsJson = fs.readJSONSync(pluginsJsonPath)
  expect(pluginsJson['node_version']).toEqual(process.version)

  expect(fs.existsSync(snappyBuild)).toEqual(true)
})

test.skip('plugins should be loaded when things cannot be rebuilt', async () => {
  if (tmpDir.config.windows) return // cannot remove package.json when loaded

  await tmpDir.plugins.install('heroku-hello-world-build', '0.0.0')

  let dataDir = tmpDir.dataDir
  let plugins = path.join(dataDir, 'plugins')

  // force a rebuild because of missing plugins.json
  let pluginsJsonPath = path.join(tmpDir.cacheDir, 'plugins.json')
  fs.removeSync(pluginsJsonPath)

  // make the yarn install --force fail
  let packageJsonPath = path.join(plugins, 'package.json')
  fs.writeFileSync(packageJsonPath, '')

  let config = {
    ...tmpDir.config,
    argv: ['cli', 'foo'],
    mock: true
  }
  let cli = new CLI({config})
  try {
    await cli.run()
  } catch (err) {
    if (err.code !== 0) throw err
  }

  let pluginsJson = fs.readJSONSync(pluginsJsonPath)
  expect(pluginsJson['node_version']).toEqual(process.version)
})
