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
const mockFetchVersion = jest.fn()
const mockAutoupdate = jest.fn()

jest.mock('../updater', () => {
  return {
    Updater: class mockUpdater {
      fetchManifest() {
        return mockManifest
      }
      fetchVersion = mockFetchVersion
      update = mockUpdate
      autoupdate = mockAutoupdate
    },
  }
})

describe('with no update available', () => {
  test('updates plugins only', async () => {
    mockManifest.version = '1.0.0'
    const cmd = await Update.run({ mock: true, argv: [], version, channel })
    expect(cmd.out.stdout.output).toEqual('')
    expect(cmd.out.stderr.output).toEqual(`cli-engine: Updating CLI... already on latest version: 1.0.0\n`)
    expect(PluginsUpdate.run).toBeCalled()
    expect(mockFetchVersion).toBeCalled()
  })
})

describe('with update available', () => {
  test('updates CLI and plugins', async () => {
    mockManifest.version = '1.0.1'
    const cmd = await Update.run({ mock: true, argv: [], version, channel })
    expect(cmd.out.stdout.output).toEqual('')
    expect(cmd.out.stderr.output).toContain(`cli-engine: Updating CLI...
cli-engine: Updating CLI from 1.0.0 to 1.0.1... done`)
    expect(mockUpdate).toBeCalled()
    expect(mockAutoupdate).toBeCalled()
    expect(PluginsUpdate.run).toBeCalled()
    expect(mockFetchVersion).toBeCalled()
  })
})
