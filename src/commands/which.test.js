// @flow

import Which from './which'
import Plugins from '../plugins'

jest.mock('../plugins')

const herokuApps = {
  type: 'user',
  name: 'heroku-apps'
}

const builtin = {
  type: 'builtin'
}

// flow$ignore
Plugins.mockImplementation(() => {
  return {
    findPluginWithCommand (cmd) {
      if (cmd === `apps:info`) return herokuApps
      if (cmd === `plugins:install`) return builtin
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
