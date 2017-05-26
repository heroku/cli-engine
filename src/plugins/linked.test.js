/* globals test expect beforeEach afterEach */

import {buildConfig} from 'cli-engine-config'
import Output from 'cli-engine-command/lib/output'
import Plugins from '../plugins'
import tmp from 'tmp'

const path = require('path')
const fs = require('fs-extra')

let testDir
let cacheDir
let dataDir
let pluginsJsonPath
let linkPath

beforeEach(async () => {
  testDir = path.join(path.dirname(__filename), '..', '..', 'test')

  dataDir = tmp.dirSync().name
  cacheDir = tmp.dirSync().name

  let linkPathSrc = path.normalize(path.join(testDir, 'links', 'test-foo'))

  linkPath = tmp.dirSync().name
  fs.copySync(linkPathSrc, linkPath)

  pluginsJsonPath = path.join(cacheDir, 'plugins.json')
})

afterEach(() => {
  fs.removeSync(cacheDir)
  fs.removeSync(dataDir)
  fs.removeSync(linkPath)
})

test('linked plugin should be cached', async () => {
  let root = path.join(testDir, 'roots', 'test-foo')
  let pjson = fs.readJSONSync(path.join(root, 'package.json'))
  let config = buildConfig({root, cacheDir, dataDir, pjson})
  let output = new Output({config, mock: true})
  let plugins = await (new Plugins(output)).init()

  let FooCore = plugins.findCommand('foo')
  expect(FooCore.description).toBe('core')

  let corePath = path.normalize(path.join(root, 'node_modules', 'test-foo'))

  await plugins.addLinkedPlugin(linkPath)

  let pluginsJson = fs.readJSONSync(pluginsJsonPath)
  expect(pluginsJson['plugins'][linkPath]).toBeUndefined()
  expect(pluginsJson['plugins'][corePath]).toBeDefined()

  plugins = await (new Plugins(output)).init()
  let FooLinked = plugins.findCommand('foo')
  expect(FooLinked.description).toBe('link')

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
    'name': 'test-foo',
    'path': linkPath,
    'topics': [
      {
        'hidden': false,
        'topic': 'foo'
      }
    ],
    'version': '0.0.0'
  })

  plugins.uninstall('test-foo')

  pluginsJson = fs.readJSONSync(pluginsJsonPath)
  expect(pluginsJson['plugins'][linkPath]).toBeUndefined()
  expect(pluginsJson['plugins'][corePath]).toBeDefined()

  plugins = await (new Plugins(output)).init()
  FooCore = plugins.findCommand('foo')
  expect(FooCore.description).toBe('core')
})

test('linked plugin prepare should clear cache', async () => {
  let root = path.join(testDir, 'roots', 'test-foo')
  let pjson = fs.readJSONSync(path.join(root, 'package.json'))
  let config = buildConfig({root, cacheDir, dataDir, pjson})
  let output = new Output({config, mock: true})
  let plugins = await (new Plugins(output)).init()

  let corePath = path.normalize(path.join(root, 'node_modules', 'test-foo'))

  await plugins.addLinkedPlugin(linkPath)

  let pluginsJson = fs.readJSONSync(pluginsJsonPath)
  expect(pluginsJson['plugins'][linkPath]).toBeUndefined()
  expect(pluginsJson['plugins'][corePath]).toBeDefined()

  plugins = await (new Plugins(output)).init()
  let FooLinked = plugins.findCommand('foo')
  expect(FooLinked.description).toBe('link')

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
    'name': 'test-foo',
    'path': linkPath,
    'topics': [
      {
        'hidden': false,
        'topic': 'foo'
      }
    ],
    'version': '0.0.0'
  }
  expect(cached).toEqual(expected)

  let laterDate = new Date(new Date().getTime() + 3600)
  fs.utimesSync(path.join(linkPath, 'commands', 'foo', 'index.js'), laterDate, laterDate)

  await plugins.refreshLinkedPlugins()

  pluginsJson = fs.readJSONSync(pluginsJsonPath)
  expect(pluginsJson['plugins'][linkPath]).toBeUndefined()
  expect(pluginsJson['plugins'][corePath]).toBeDefined()
})
