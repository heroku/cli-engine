// @flow

import Install from './install'

let mockInstall

jest.mock('../../plugins', () => {
  return class Plugins {
    install = mockInstall
    async init () {
      return this
    }
    list () {
      return []
    }
  }
})

beforeEach(() => {
  mockInstall = jest.fn()
})

test('installs heroku-debug', async () => {
  const cmd = await Install.mock('heroku-debug')
  expect(cmd.out.stderr.output).toEqual('Installing plugin heroku-debug...\nInstalling plugin heroku-debug... done\n')
  expect(mockInstall).toBeCalledWith('heroku-debug', 'latest')
})

test('installs heroku-debug@alpha', async () => {
  const cmd = await Install.mock('heroku-debug@alpha')
  expect(cmd.out.stderr.output).toEqual('Installing plugin heroku-debug@alpha...\nInstalling plugin heroku-debug@alpha... done\n')
  expect(mockInstall).toBeCalledWith('heroku-debug', 'alpha')
})
