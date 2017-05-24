/* globals test expect beforeEach */

import Plugins from '../plugins'
import {tmpDirs} from '../../test/helpers'

const path = require('path')
const fs = require('fs-extra')

jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000

let tmpDir
beforeEach(() => {
  tmpDir = tmpDirs()
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
  DebugUser = plugins.findCommand('debug')
  expect(DebugUser).toBeDefined()

  pluginsJson = fs.readJSONSync(pluginsJsonPath)
  expect(pluginsJson['plugins'][userPath]).toBeDefined()

  await plugins.uninstall('heroku-debug')

  pluginsJson = fs.readJSONSync(pluginsJsonPath)
  expect(pluginsJson['plugins'][userPath]).toBeUndefined()
})
