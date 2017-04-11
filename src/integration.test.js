// @flow
/* globals test expect describe beforeEach afterEach */

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

describe('cli help', () => {
  describe('global help', () => {
    let globalHelpOutput = /^Usage: \S+ COMMAND \[--app APP] \[command-specific-options]$/m

    test('shows help when no arguments given', async function () {
      let cmd = await run()
      expect(cmd.stdout.output).toMatch(globalHelpOutput)
    })

    test('shows help for `help` command and no additonal arguments', async function () {
      let cmd = await run('help')
      expect(cmd.stdout.output).toMatch(globalHelpOutput)
    })

    test('shows help for `--help` or `-h` flag and no additonal arguments', async function () {
      let cmd = await run('--help')
      let cmnd = await run('-h')
      expect(cmd.stdout.output).toMatch(globalHelpOutput)
      expect(cmnd.stdout.output).toMatch(globalHelpOutput)
    })
  })

  describe('--help & -h flags', () => {
    let pluginsHelpOutput = /^Usage: \S+ plugins\n\s+--core\n\s+\S+ plugins commands: \(\S+ help plugins:COMMAND for details\)$/m
    let pluginsInstallHelpOutput = /^Usage: \S+ plugins:install PLUGIN\n\s+installs a plugin into the CLI\n\s+Example:$/m

    test('shows help for plugins', async function () {
      let cmd = await run('plugins', '--help')
      let cmnd = await run('plugins', '-h')
      expect(cmd.stdout.output).toMatch(pluginsHelpOutput)
      expect(cmnd.stdout.output).toMatch(pluginsHelpOutput)
    })

    test('shows help for plugins (prefixed)', async function () {
      let cmd = await run('--help', 'plugins')
      let cmnd = await run('-h', 'plugins')
      expect(cmd.stdout.output).toMatch(pluginsHelpOutput)
      expect(cmnd.stdout.output).toMatch(pluginsHelpOutput)
    })

    test('shows help for plugins:install', async function () {
      let cmd = await run('plugins:install', 'heroku-sudo', '--help')
      let cmnd = await run('plugins:install', 'heroku-sudo', '-h')
      expect(cmd.stdout.output).toMatch(pluginsInstallHelpOutput)
      expect(cmnd.stdout.output).toMatch(pluginsInstallHelpOutput)
    })

    test('shows help for plugins:install (prefixed)', async function () {
      let cmd = await run('--help', 'plugins:install', 'heroku-sudo')
      let cmnd = await run('-h', 'plugins:install', 'heroku-sudo')
      expect(cmd.stdout.output).toMatch(pluginsInstallHelpOutput)
      expect(cmnd.stdout.output).toMatch(pluginsInstallHelpOutput)
    })
  })

  describe('edge cases', () => {
    test('shows help for `help` command itself', async function () {
      let cmd = await run('help', 'help')
      expect(cmd.stdout.output).toMatch(/^Usage: \S+ help$/m)
    })

    test.skip('shows help if present before `--`', async function () {
      let cmd = await run('run', '-h', '-a', 'rbriggs-sushi', '--', 'man', '-h')
      expect(cmd.stdout.output).toMatch(/^Usage: /m)
    })

    test.skip('ignores help if present after `--`', async function () {
      let cmd = await run('run', '-a', 'rbriggs-sushi', '--', 'man', '-h')
      expect(cmd.stdout.output).toMatch(/^man, version/m)
    })
  })
})
