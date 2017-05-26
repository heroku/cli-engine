// @flow

import CLI from './cli'

import {tmpDirs} from '../test/helpers'

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

test('installs, runs, and uninstalls heroku-debug', async () => {
  await run('plugins:install', 'heroku-debug@4.0.0')
  await run('debug')
  await run('plugins:uninstall', 'heroku-debug')
  expect(await plugins()).not.toContain('heroku-debug')
})

test('tries to install a non-existant tag', async () => {
  expect.assertions(1)
  await expect(run('plugins:install', 'heroku-debug@not-found')).rejects.toEqual(
    new Error('yarn --non-interactive --prefer-offline exited with code 1\nerror Couldn\'t find package "heroku-debug" on the "npm" registry.\n')
  )
})

test('links example plugin', async () => {
  await run('plugins:link', './example-plugin')
  let cmd = await run('cli:test')
  expect(cmd.out.stdout.output).toEqual('ran cli:test\n')
})
