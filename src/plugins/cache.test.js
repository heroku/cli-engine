// @flow

import Cache from './cache'
import Output from 'cli-engine-command/lib/output'
import path from 'path'
import fs from 'fs-extra'

jest.mock('fs-extra')

const myplugin = {name: 'myplugin', path: 'myplugin', version: '1.0.0', topics: [], commands: []}

let output
let config

beforeEach(() => {
  output = new Output()
  config = output.config
})

afterEach(() => {
  jest.resetAllMocks()
})

test('updatePlugin', () => {
  let cache = new Cache(output)
  cache.updatePlugin('myplugin', myplugin)
  cache.save()
  expect(fs.writeJSONSync).toBeCalledWith(
    path.join(config.cacheDir, 'plugins.json'),
    {plugins: {myplugin}, version: config.version}
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
    let cache = new Cache(output)
    expect(cache.plugin('myplugin')).toMatchObject({version: '1.0.0'})
  })

  test('deletePlugin', () => {
    let cache = new Cache(output)
    cache.deletePlugin('myplugin')
    expect(fs.writeJSONSync).toBeCalledWith(
      path.join(config.cacheDir, 'plugins.json'),
      {plugins: {}, version: config.version}
    )
  })
})
