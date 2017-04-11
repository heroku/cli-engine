// @flow

import Update from './update'
import PluginsUpdate from './plugins/update'

const version = '1.0.0'
const channel = 'stable'

const mockManifest = {}

jest.mock('./plugins/update', () => {
  return class {
    static run = jest.fn()
  }
})

const mockUpdate = jest.fn()

jest.mock('../updater', () => {
  return class {
    fetchManifest () { return mockManifest }
    update = mockUpdate
  }
})

describe('with no update available', () => {
  test('updates plugins only', async () => {
    mockManifest.version = '1.0.0'
    const cmd = await Update.run({mock: true, config: {version, channel}})
    expect(cmd.out.stdout.output).toEqual('')
    expect(cmd.out.stderr.output).toEqual(`cli-engine: Updating CLI...
cli-engine: Updating CLI... already on latest version: 1.0.0
`)
    expect(PluginsUpdate.run).toBeCalled()
  })
})

describe('with update available', () => {
  test('updates CLI and plugins', async () => {
    mockManifest.version = '1.0.1'
    const cmd = await Update.run({mock: true, config: {version, channel}})
    expect(cmd.out.stdout.output).toEqual('')
    expect(cmd.out.stderr.output).toEqual(`cli-engine: Updating CLI...
cli-engine: Updating CLI to 1.0.1...
cli-engine: Updating CLI to 1.0.1... done
`)
    expect(mockUpdate).toBeCalled()
    expect(PluginsUpdate.run).toBeCalled()
  })
})
