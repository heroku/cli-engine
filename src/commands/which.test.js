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
    list () {
      return [herokuApps, builtin]
    }
  }
})

test('errors if not found', async () => {
  expect.assertions(1)
  try {
    await Which.run(['notfoundcommand'], {mock: true})
  } catch (err) {
    expect(err.message).toEqual('not found')
  }
})

test('finds a user plugin', async () => {
  let cmd = await Which.run(['apps:info'], {mock: true})
  expect(cmd.stdout.output).toEqual('Command from user plugin heroku-apps\n')
})

test('finds a builtin command', async () => {
  let cmd = await Which.run(['plugins:install'], {mock: true})
  expect(cmd.stdout.output).toEqual('builtin command\n')
})
