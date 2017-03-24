// @flow

import CLI from './cli'
import {integrationLock} from '../test/helpers'

jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000

let unlock
beforeEach(async () => { unlock = await integrationLock() })
afterEach(() => unlock())

async function run (...argv: string[]) {
  let cli = new CLI({argv: ['cli'].concat(argv), mock: true})
  try {
    await cli.run()
  } catch (err) {
    if (err.code !== 0) throw err
  }
  return cli.cmd
}

async function plugins (): Promise<string> {
  const index = await run('plugins')
  return index.stdout.output
}

test('installs, runs, and uninstalls heroku-debug', async () => {
  if ((await plugins()).includes('heroku-debug')) await run('plugins:uninstall', 'heroku-debug')
  await run('plugins:install', 'heroku-debug')
  await run('debug')
  await run('plugins:uninstall', 'heroku-debug')
})

test('links example plugin', async () => {
  if ((await plugins()).includes('cli-engine-example-plugin')) await run('plugins:uninstall', 'cli-engine-example-plugin')
  await run('plugins:link', './example-plugin')
  let cmd = await run('cli:test')
  expect(cmd.stdout.output).toEqual('ran cli:test\n')
})

describe('help flag', () => {
  describe('--help', () => {
    test('shows help for plugins', async function () {
      let cmd = await run('plugins', '--help')
      expect(cmd.stdout.output).toMatch(/^ +plugins:install PLUGIN +# installs a plugin into the CLI$/m)
    })
  })

  describe('-h', () => {
    test('shows help for plugins', async function () {
      let cmd = await run('plugins', '-h')
      expect(cmd.stdout.output).toMatch(/^ +plugins:install PLUGIN +# installs a plugin into the CLI$/m)
    })
  })
})
