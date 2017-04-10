// @flow

import PluginsUpdate from './update'

let mockUpdate

jest.mock('../../plugins', () => {
  return class Plugins {
    update = mockUpdate
  }
})

beforeEach(() => {
  mockUpdate = jest.fn()
})

test('updates plugins', async () => {
  let cmd = await PluginsUpdate.mock()
  expect(mockUpdate).toBeCalledWith()
  expect(cmd.stderr.output).toEqual('cli-engine-command: Updating plugins...\ncli-engine-command: Updating plugins... done\n')
})
