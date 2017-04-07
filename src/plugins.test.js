/* globals test expect beforeEach */

import { Config } from 'cli-engine-command'
import Output from 'cli-engine-command/lib/output'
import Plugins from './plugins'

const path = require('path')
const fs = require('fs-extra')

class MockDirs {
  constructor (options) {
    this._options = options
  }

  get cache () {
    return this._options.cache
  }

  get data () {
    return this._options.cache
  }
}

let testDir
let cache
let data
let pluginsJsonPath

beforeEach(() => {
  testDir = path.join(path.dirname(__filename), '..', 'test')

  data = path.join(testDir, 'data')
  cache = path.join(testDir, 'cache')

  pluginsJsonPath = path.join(cache, 'plugins.json')

  fs.removeSync(cache)
  fs.ensureDirSync(cache)

  fs.removeSync(data)
  fs.ensureDirSync(data)

  fs.removeSync(pluginsJsonPath)
})

test('default should be found', async () => {
  let root = path.join(testDir, 'roots', 'test-foo')
  let config = new Config({
    argv: ['heroku', 'foo'],
    debug: true,
    mock: true,
    root: root
  })
  config.dirs = new MockDirs({cache, data})
  let output = new Output(config)
  let plugins = new Plugins(output)

  let foo = plugins.findCommand('foo')
  expect(foo).toBeDefined()
})
