// @flow

import Plugins from '../plugins'
import {tmpDirs} from '../../test/helpers'
import CLI from '../cli'
import tmp from 'tmp'

const path = require('path')
const fs = require('fs-extra')

jest.unmock('fs-extra')

jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000

let pluginsJsonPath

function copyLink (link) {
  let testDir = path.join(path.dirname(__filename), '..', '..', 'test')
  let linkPathSrc = path.normalize(path.join(testDir, 'links', link))
  let tmpDir = tmp.dirSync().name
  fs.copySync(linkPathSrc, tmpDir)
  return tmpDir
}

let tmpDir
beforeEach(async () => {
  tmpDir = await tmpDirs()
  pluginsJsonPath = path.join(tmpDir.cacheDir, 'plugins.json')
})

afterEach(() => {
  tmpDir.clean()
})

test('linked plugin should be cached', async () => {
  let FooCore = await tmpDir.plugins.findCommand('foo')
  expect(FooCore).toHaveProperty('description', 'core')

  let corePath = path.normalize(path.join(tmpDir.root, 'node_modules', 'cli-engine-test-foo'))

  let linkPath = copyLink('cli-engine-test-foo')
  await tmpDir.plugins.addLinkedPlugin(linkPath)

  let pluginsJson = fs.readJSONSync(pluginsJsonPath)
  expect(pluginsJson['plugins'][linkPath]).toBeUndefined()
  expect(pluginsJson['plugins'][corePath]).toBeDefined()

  let plugins = new Plugins(tmpDir.output)
  await plugins.load()
  let FooLinked = await plugins.findCommand('foo')
  expect(FooLinked).toHaveProperty('description', 'link')

  pluginsJson = fs.readJSONSync(pluginsJsonPath)
  let cached = pluginsJson['plugins'][linkPath]
  expect(cached).toEqual({
    'commands': [
      {
        'aliases': [],
        'description': 'link',
        'flags': {},
        'hidden': false,
        'id': 'foo',
        'topic': 'foo'
      }
    ],
    'name': 'cli-engine-test-foo',
    'path': linkPath,
    'topics': [
      {
        'id': 'foo',
        'hidden': false,
        'topic': 'foo'
      }
    ],
    'version': '0.0.0'
  })

  await plugins.uninstall('cli-engine-test-foo')

  pluginsJson = fs.readJSONSync(pluginsJsonPath)
  expect(pluginsJson['plugins'][linkPath]).toBeUndefined()
  expect(pluginsJson['plugins'][corePath]).toBeDefined()

  plugins = new Plugins(tmpDir.output)
  await plugins.load()
  FooCore = await plugins.findCommand('foo')
  expect(FooCore).toHaveProperty('description', 'core')
})

test('linked plugin prepare should clear cache', async () => {
  let corePath = path.normalize(path.join(tmpDir.root, 'node_modules', 'cli-engine-test-foo'))

  let linkPath = copyLink('cli-engine-test-foo')
  await tmpDir.plugins.addLinkedPlugin(linkPath)

  let pluginsJson = fs.readJSONSync(pluginsJsonPath)
  expect(pluginsJson['plugins'][linkPath]).toBeUndefined()
  expect(pluginsJson['plugins'][corePath]).toBeDefined()

  let plugins = new Plugins(tmpDir.output)
  await plugins.load()
  let FooLinked = await plugins.findCommand('foo')
  expect(FooLinked).toHaveProperty('description', 'link')

  pluginsJson = fs.readJSONSync(pluginsJsonPath)
  let cached = pluginsJson['plugins'][linkPath]
  let expected = {
    'commands': [
      {
        'aliases': [],
        'description': 'link',
        'flags': {},
        'hidden': false,
        'id': 'foo',
        'topic': 'foo'
      }
    ],
    'name': 'cli-engine-test-foo',
    'path': linkPath,
    'topics': [
      {
        'id': 'foo',
        'hidden': false,
        'topic': 'foo'
      }
    ],
    'version': '0.0.0'
  }
  expect(cached).toEqual(expected)

  let laterDate = new Date(new Date().getTime() + 3600)
  fs.utimesSync(path.join(linkPath, 'commands', 'foo', 'index.js'), laterDate, laterDate)

  plugins.linked.loaded = false
  await plugins.linked.load()

  pluginsJson = fs.readJSONSync(pluginsJsonPath)
  expect(pluginsJson['plugins'][linkPath]).toBeUndefined()
  expect(pluginsJson['plugins'][corePath]).toBeDefined()
})

test('plugins should be reloaded when node_version changed', async () => {
  let linkPath = copyLink('1_hello_world')
  await tmpDir.plugins.addLinkedPlugin(linkPath)

  let pluginsJsonPath = path.join(tmpDir.cacheDir, 'plugins.json')

  // emulate an old version of node
  let pluginsJson = fs.readJSONSync(pluginsJsonPath)
  pluginsJson['node_version'] = '1.0.0'
  fs.writeJSONSync(pluginsJsonPath, pluginsJson)

  // attempt to emulate a build mismatch by removing build from snappy
  let buildDir = path.join(linkPath, 'build')
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

test('plugins should be loaded when things cannot be rebuilt', async () => {
  let linkPath = copyLink('1_hello_world')
  await tmpDir.plugins.addLinkedPlugin(linkPath)

  // force a rebuild because of missing plugins.json
  let pluginsJsonPath = path.join(tmpDir.cacheDir, 'plugins.json')
  fs.removeSync(pluginsJsonPath)

  // make the yarn install --force fail
  let packageJsonPath = path.join(linkPath, 'package.json')
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
