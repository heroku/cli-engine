// @flow

const run = require('../test/run').foo

jest.unmock('fs-extra')

jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000

async function plugins (): Promise<?string> {
  const {stdout} = await run(['plugins'])
  return stdout
}

let dir = console.dir
let mockDir

beforeEach(() => {
  // flow$ignore
  console.dir = mockDir = jest.fn()
})

afterEach(() => {
  // flow$ignore
  console.dir = dir
})

test('installs, runs, and uninstalls heroku-debug', async () => {
  await run(['plugins:install', 'heroku-debug@4.0.0'])
  await run(['debug'])
  await run(['plugins:uninstall', 'heroku-debug'])
  expect(await plugins()).not.toContain('heroku-debug')
  expect(mockDir.mock.calls[0][0]).toMatchObject({context: {apiHost: 'api.heroku.com'}})
})

test('tries to install a non-existant tag', async () => {
  let cmd = await run(['plugins:install', 'heroku-debug@not-found'])
  if (!cmd.err) throw new Error('no error')
  expect(cmd.err.message).toContain('exited with code 1\nerror Couldn\'t find any versions for "heroku-debug" that matches "not-found"\n')
})

test('links example plugin', async () => {
  await run(['plugins:link', './example-plugin'])
  let cmd = await run(['cli:test'])
  expect(cmd.stdout).toEqual('ran cli:test\n')
})
