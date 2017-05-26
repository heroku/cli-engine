// @flow

import PluginsUpdate from './update'
let mockUpdate

jest.mock('../../plugins', () => {
  return class Plugins {
    update = mockUpdate
    init = async function () { return this }
  }
})

beforeEach(() => {
  mockUpdate = jest.fn()
})

test('updates plugins', async () => {
  let cmd = await PluginsUpdate.mock()
  expect(mockUpdate).toBeCalledWith()
  expect(cmd.out.stderr.output).toEqual('cli-engine: Updating plugins...\ncli-engine: Updating plugins... done\n')
})
