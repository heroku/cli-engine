// @flow

import {tmpDirs} from '../../test/helpers'
import CLI from '../cli'
import Plugins from '../plugins'

import path from 'path'
import fs from 'fs-extra'

jest.unmock('fs-extra')

let mockYarnExec
jest.mock('./yarn', () => {
  return class {
    exec = mockYarnExec
  }
})

jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000

let tmpDir
beforeEach(async () => {
  tmpDir = await tmpDirs()
  mockYarnExec = jest.fn()
})

afterEach(() => {
  tmpDir.clean()
})

test('plugins should be reloaded if migrated', async () => {
  let dataDir = tmpDir.dataDir

  let src = path.join(__dirname, '..', '..', 'test', 'links', 'test-migrator')
  fs.mkdirsSync(path.join(dataDir, 'plugins'))

  let dst = path.join(dataDir, 'plugins', 'node_modules', 'test-migrator')
  fs.copySync(src, dst)

  let json = [{name: 'test-migrator'}]
  fs.writeJSONSync(path.join(dataDir, 'plugins', 'plugins.json'), json)

  let cli = new CLI({argv: ['cli', 'migrator'], mock: true, config: tmpDir.config})
  try {
    await cli.run()
  } catch (err) {
    if (err.code !== 0) throw err
  }
})

test('linked plugins should be migrated', async () => {
  if (process.platform === 'win32') {
    return
  }

  let dataDir = tmpDir.dataDir

  let testDir = path.join(path.dirname(__filename), '..', '..', 'test')
  let src = path.normalize(path.join(testDir, 'links', 'test-migrator'))
  fs.mkdirsSync(path.join(dataDir, 'plugins'))

  let dst = path.join(dataDir, 'plugins', 'node_modules', 'test-migrator')
  fs.mkdirsSync(path.join(dataDir, 'plugins', 'node_modules'))
  fs.symlinkSync(src, dst)

  let json = [{name: 'test-migrator', tag: 'symlink'}]
  fs.writeJSONSync(path.join(dataDir, 'plugins', 'plugins.json'), json)

  let cli = new CLI({argv: ['cli', 'foo'], mock: true, config: tmpDir.config})
  try {
    await cli.run()
  } catch (err) {
    if (err.code !== 0) throw err
  }

  let plugins = new Plugins({output: tmpDir.output})
  await plugins.load()
  let MigratorLinked = await plugins.findCommand('migrator')
  expect(MigratorLinked).toHaveProperty('description', 'link')
})

test('linked plugins that override core should be migrated', async () => {
  if (process.platform === 'win32') {
    return
  }

  let dataDir = tmpDir.dataDir

  let testDir = path.join(path.dirname(__filename), '..', '..', 'test')
  let src = path.normalize(path.join(testDir, 'links', 'test-foo'))
  fs.mkdirsSync(path.join(dataDir, 'plugins'))

  let dst = path.join(dataDir, 'plugins', 'node_modules', 'test-foo')
  fs.mkdirsSync(path.join(dataDir, 'plugins', 'node_modules'))
  fs.symlinkSync(src, dst)

  let json = [{name: 'test-foo', tag: 'symlink'}]
  fs.writeJSONSync(path.join(dataDir, 'plugins', 'plugins.json'), json)

  let cli = new CLI({argv: ['cli', 'foo'], mock: true, config: tmpDir.config})
  try {
    await cli.run()
  } catch (err) {
    if (err.code !== 0) throw err
  }

  let plugins = new Plugins({output: tmpDir.output})
  await plugins.load()
  let MigratorLinked = await plugins.findCommand('foo')
  expect(MigratorLinked).toHaveProperty('description', 'link')
})
