/* globals test expect beforeEach */

import {buildConfig} from 'cli-engine-config'
import Output from 'cli-engine-command/lib/output'
import Plugins from '../plugins'
import tmp from 'tmp'
import {integrationLock} from '../../test/helpers'

const path = require('path')
const fs = require('fs-extra')

let testDir
let cacheDir
let dataDir
let pluginsJsonPath

jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000

let unlock
beforeEach(async () => { unlock = await integrationLock() })
afterEach(() => unlock())

beforeEach(() => {
  testDir = path.join(path.dirname(__filename), '..', '..', 'test')

  dataDir = tmp.dirSync().name
  cacheDir = tmp.dirSync().name

  pluginsJsonPath = path.join(cacheDir, 'plugins.json')
})

afterEach(() => {
  fs.removeSync(cacheDir)
  fs.removeSync(dataDir)
})

test('user plugin should be cached', async () => {
  let root = path.join(testDir, 'roots', 'test-foo')
  let pjson = fs.readJSONSync(path.join(root, 'package.json'))
  let config = buildConfig({root, cacheDir, dataDir, pjson})
  let output = new Output({config, mock: true})
  let plugins = new Plugins(output)

  let userPath = path.normalize(path.join(dataDir, 'plugins', 'node_modules', 'heroku-debug'))

  await plugins.install('heroku-debug', 'alpha')

  let pluginsJson = fs.readJSONSync(pluginsJsonPath)
  expect(pluginsJson['plugins'][userPath]).toBeUndefined()

  plugins = new Plugins(output)
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

  plugins = new Plugins(output)
  DebugUser = plugins.findCommand('debug')
  expect(DebugUser).toBeDefined()

  pluginsJson = fs.readJSONSync(pluginsJsonPath)
  expect(pluginsJson['plugins'][userPath]).toBeDefined()

  await plugins.uninstall('heroku-debug')

  pluginsJson = fs.readJSONSync(pluginsJsonPath)
  expect(pluginsJson['plugins'][userPath]).toBeUndefined()
})
