// @flow

import Cache from './cache'
import path from 'path'
import fs from 'fs-extra'
import {defaultConfig as config} from 'cli-engine-config'

jest.mock('fs-extra')

const myplugin = {name: 'myplugin', path: 'myplugin', version: '1.0.0', topics: [], commands: []}

afterEach(() => {
  jest.resetAllMocks()
})

test('new Cache(output)', () => {
  let cache = new Cache(config)
  expect(cache.cache.node_version).toBeNull()
})

test('updatePlugin', () => {
  let cache = new Cache(config)
  cache.updatePlugin('myplugin', myplugin)
  cache.save()
  expect(fs.writeJSONSync).toBeCalledWith(
    path.join(cache.config.cacheDir, 'plugins.json'),
    {node_version: null, plugins: {myplugin}, version: cache.config.version}
  )
})

describe('with existing file', () => {
  beforeEach(() => {
    fs.__files({
      [config.cacheDir]: {
        'plugins.json': {
          version: config.version,
          plugins: {myplugin}
        }
      }
    })
  })

  test('reads existing plugin data', () => {
    let cache = new Cache(config)
    expect(cache.plugin('myplugin')).toMatchObject({version: '1.0.0'})
  })

  test('deletePlugin', () => {
    let cache = new Cache(config)
    cache.deletePlugin('myplugin')
    expect(fs.writeJSONSync).toBeCalledWith(
      path.join(config.cacheDir, 'plugins.json'),
      {plugins: {}, version: config.version}
    )
  })
})

describe('with existing for a previous version', () => {
  beforeEach(() => {
    fs.__files({
      [config.cacheDir]: {
        'plugins.json': {
          version: '1.0.0',
          plugins: {myplugin},
          node_version: '2.0.0'
        }
      }
    })
  })

  test('does not clear node_version', () => {
    let cache = new Cache(config)
    expect(cache.cache).toEqual({node_version: '2.0.0', plugins: {}, version: config.version})
  })
})
