/* globals test expect beforeEach */

import {Config} from 'cli-engine-command'
import Output from 'cli-engine-command/lib/output'
import Plugins from './plugins'
import Help from './commands/help'
import PluginsLink from './commands/plugins/link'
import klaw from 'klaw-sync'

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

function touchDirectory (path, mtime) {
  klaw(path, {nodir: true, ignore: '{node_modules,.git}'})
  .filter(f => f.path.endsWith('.js'))
  .forEach(f => touchKlaw(f, mtime))
}

function touchKlaw (klaw, mtime) {
  let fd = fs.openSync(klaw.path, 'r')
  fs.futimesSync(fd, klaw.stats.atime, mtime)
  fs.closeSync(fd)
}

function touchPath (path, mtime) {
  let fd = fs.openSync(path, 'r')
  let stats = fs.fstatSync(fd)
  fs.futimesSync(fd, stats.atime, mtime)
  fs.closeSync(fd)
}

test('linked plugin should be cached', async () => {
  let root = path.join(testDir, 'roots', 'empty')
  let config = new Config({
    argv: ['heroku', 'foo'],
    debug: true,
    mock: true,
    root: root
  })
  config.dirs = new MockDirs({cache, data})
  let output = new Output(config)
  let plugins = new Plugins(output)

  let linkPath = path.normalize(path.join(testDir, 'links', 'test-foo'))

  let date = new Date()
  touchDirectory(linkPath, date)

  /*
   * Wanted to go through findCommand but it messes up the config.dirs mock
   * since when it does a new Config(config) which does not reuse dirs
   * otherwise it writes to ~/.local/share/heroku-cli/linked_plugins.json
   *
   * let linkCommand = plugins.findCommand('plugins:link')
   * linkCommand.run([linkPath], config)
   */
  await plugins.addLinkedPlugin(linkPath)

  let pluginsJson = fs.readJSONSync(pluginsJsonPath)

  console.log(pluginsJson)

  expect(pluginsJson['plugins'][linkPath]).toBeDefined()
  expect(pluginsJson['plugins'][linkPath]['mtime']).toBeDefined()

  // let fooPath = path.normalize(path.join(root, 'node_modules', 'test-foo'))
  // expect(pluginsJson['plugins'][fooPath]).toBeDefined()
})

/*
test('linked plugin should be cached', async () => {
  let laterDate = new Date(date.getTime() + 1)

  touchPath(path.join(linkPath, 'commands', 'foo', 'index.js'), laterDate)
})
*/
