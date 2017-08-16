// @flow

import CLI from './cli'

import {tmpDirs} from '../test/helpers'

jest.unmock('fs-extra')

jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000

let tmpDir

beforeEach(async () => {
  tmpDir = await tmpDirs()
})

afterEach(async () => {
  tmpDir.clean()
})

async function run (...argv: string[]) {
  let cli = new CLI({argv: ['cli'].concat(argv), mock: true, config: tmpDir.config})
  try {
    await cli.run()
  } catch (err) {
    if (err.code !== 0) throw err
  }
  return cli.cmd
}

async function plugins (): Promise<string> {
  const index = await run('plugins')
  return index.out.stdout.output
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
  await run('plugins:install', 'heroku-debug@4.0.0')
  await run('debug')
  await run('plugins:uninstall', 'heroku-debug')
  expect(await plugins()).not.toContain('heroku-debug')
  expect(mockDir.mock.calls[0][0]).toMatchObject({context: {apiHost: 'api.heroku.com'}})
})

test('tries to install a non-existant tag', async () => {
  expect.assertions(1)
  try {
    await run('plugins:install', 'heroku-debug@not-found')
  } catch (err) {
    expect(err.message).toContain('exited with code 1\nerror Couldn\'t find any versions for \"heroku-debug\" that matches \"not-found\"\n')
  }
})

test('links example plugin', async () => {
  await run('plugins:link', './example-plugin')
  let cmd = await run('cli:test')
  expect(cmd.out.stdout.output).toEqual('ran cli:test\n')
})
