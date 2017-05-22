/* globals test expect beforeEach */

import Plugins from '../plugins'
import {tmpDirs} from '../../test/helpers'
import CLI from '../cli'

const path = require('path')
const fs = require('fs-extra')
const childProcess = require('child_process')

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

  let plugins = await (new Plugins(tmpDir.output)).init()
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

  plugins = await (new Plugins(tmpDir.output)).init()
  DebugUser = plugins.findCommand('debug')
  expect(DebugUser).toBeDefined()

  pluginsJson = fs.readJSONSync(pluginsJsonPath)
  expect(pluginsJson['plugins'][userPath]).toBeDefined()

  await plugins.uninstall('heroku-debug')

  pluginsJson = fs.readJSONSync(pluginsJsonPath)
  expect(pluginsJson['plugins'][userPath]).toBeUndefined()
})

test('plugins should be reloaded when node_version null or changed', async () => {
  let dataDir = tmpDir.dataDir

  let src = path.join(__dirname, '..', '..', 'test', 'links', '1_hello_world')
  fs.mkdirsSync(path.join(dataDir, 'plugins'))

  let plugins = path.join(dataDir, 'plugins')

  let dst = path.join(plugins, 'node_modules', '1_hello_world')
  fs.copySync(src, dst)

  let npm = path.join(__dirname, '..', '..', 'node_modules', 'npm', 'cli.js')
  childProcess.execFileSync(process.execPath, [npm, 'install'], {cwd: dst})

  // remove the cache that tmpDirs creates
  let pluginsJsonPath = path.join(tmpDir.cacheDir, 'plugins.json')
  fs.removeSync(pluginsJsonPath)

  // attempt to emulate a build mismatch by remove lib
  let buildDir = path.join(plugins, 'node_modules', '1_hello_world', 'build')
  fs.removeSync(buildDir)

  let json = [{name: '1_hello_world'}]
  fs.writeJSONSync(path.join(dataDir, 'plugins', 'plugins.json'), json)

  let cli = new CLI({argv: ['cli', 'hello'], mock: true, config: tmpDir.config})
  try {
    await cli.run()
  } catch (err) {
    if (err.code !== 0) throw err
  }

  let pluginsJson = fs.readJSONSync(pluginsJsonPath)
  expect(pluginsJson['node_version']).toEqual(process.version)

  let file = fs.openSync(buildDir, 'r')
  fs.futimesSync(file, 0, 0)
  fs.closeSync(file)

  cli = new CLI({argv: ['cli', 'hello'], mock: true, config: tmpDir.config})
  try {
    await cli.run()
  } catch (err) {
    if (err.code !== 0) throw err
  }

  expect(new Date(0)).toEqual(fs.statSync(buildDir).mtime)

  // force a node_version mismatch in the cache
  pluginsJson = fs.readJSONSync(pluginsJsonPath)
  pluginsJson['node_version'] = 'v0.0.0'
  fs.writeJSONSync(pluginsJsonPath, pluginsJson)

  cli = new CLI({argv: ['cli', 'hello'], mock: true, config: tmpDir.config})
  try {
    await cli.run()
  } catch (err) {
    if (err.code !== 0) throw err
  }

  expect(new Date(0)).not.toEqual(fs.statSync(buildDir).mtime)
})
