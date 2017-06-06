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
  await PluginsUpdate.mock()
  expect(mockUpdate).toBeCalledWith()
})
