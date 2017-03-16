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

describe.skip('with no update available', () => {
  test('updates plugins only', async () => {
    mockManifest.version = '1.0.0'
    const cmd = await Update.run([], {mock: true, version, channel})
    expect(cmd.stdout.output).toEqual('')
    expect(cmd.stderr.output).toEqual(`cli-engine-command: Updating CLI...
cli-engine-command: Updating CLI... already on latest version: 1.0.0
`)
    expect(PluginsUpdate.run).toBeCalled()
  })
})

describe.skip('with update available', () => {
  test('updates CLI and plugins', async () => {
    mockManifest.version = '1.0.1'
    const cmd = await Update.run([], {mock: true, version, channel})
    expect(cmd.stdout.output).toEqual('')
    expect(cmd.stderr.output).toEqual(`cli-engine-command: Updating CLI...
cli-engine-command: Updating CLI to 1.0.1...
cli-engine-command: Updating CLI to 1.0.1... done
`)
    expect(mockUpdate).toBeCalled()
    expect(PluginsUpdate.run).toBeCalled()
  })
})
