// @flow

import Which from './which'
import Plugins from '../plugins'

jest.mock('../plugins')

const herokuApps = {
  type: 'user',
  name: 'heroku-apps',
  findCommand (cmd: string) {
    return cmd === 'apps:info'
  }
}

const builtin = {
  type: 'builtin',
  findCommand (cmd: string) {
    return cmd === 'plugins:install'
  }
}

// flow$ignore
Plugins.mockImplementation(() => {
  return {
    async init () {
      return this
    },
    list () {
      return [herokuApps, builtin]
    }
  }
})

test('errors if not found', async () => {
  expect.assertions(1)
  try {
    await Which.mock('notfoundcommand')
  } catch (err) {
    expect(err.message).toEqual('not found')
  }
})

test('finds a user plugin', async () => {
  let cmd = await Which.mock('apps:info')
  expect(cmd.out.stdout.output).toEqual('Command from user plugin heroku-apps\n')
})

test('finds a builtin command', async () => {
  let cmd = await Which.mock('plugins:install')
  expect(cmd.out.stdout.output).toEqual('builtin command\n')
})
