// @flow

const run = require('../test/run').example

jest.unmock('fs-extra')

jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000

test('runs the version command', async function () {
  let {stdout} = await run(['version'])
  expect(stdout).toContain('cli-engine-example/1.')
})

test('errors with invalid arguments', async function () {
  let {stderr} = await run(['version', '--invalid-flag'])
  expect(stderr).toContain('Unexpected argument --invalid-flag')
})

test('errors when command not found', async function () {
  await run(['foobar12345'], {code: 127})
})

describe('edge cases', () => {
  test('shows help for `help` command itself', async function () {
    let {stdout} = await run(['help'])
    expect(stdout).toMatch(/Usage: cli-engine COMMAND/)
  })
})

describe('cli help', () => {
  describe('global help', () => {
    let globalHelpOutput = /^Usage: \S+ COMMAND/m

    test('shows help when no arguments given', async function () {
      let {stdout} = await run()
      expect(stdout).toMatch(globalHelpOutput)
    })

    test('shows help for `help` command and no additonal arguments', async function () {
      let {stdout} = await run(['help'])
      expect(stdout).toMatch(globalHelpOutput)
    })

    test('shows help for `--help` or `-h` flag and no additonal arguments', async function () {
      let {stdout} = await run(['--help'])
      expect(stdout).toMatch(globalHelpOutput)
      let {stdout: stdout2} = await run(['-h'])
      expect(stdout2).toMatch(globalHelpOutput)
    })
  })

  describe('--help & -h flags', () => {
    let pluginsHelpOutput = `Usage: cli-engine plugins [flags]

list installed plugins

Flags:
 --core  show core plugins

Example:
    $ heroku plugins
    heroku-ci 1.8.0
    heroku-cli-status 3.0.10 (link)
    heroku-fork 4.1.22

cli-engine plugins commands: (get help with cli-engine help plugins:COMMAND)
 plugins                   list installed plugins
 plugins:install PLUGIN    installs a plugin into the CLI
 plugins:link [PATH]       links a local plugin to the CLI for development
 plugins:uninstall PLUGIN  uninstalls or unlinks a plugin
 plugins:update            update installed plugins

`
    let pluginsInstallHelpOutput = `Usage: cli-engine plugins:install PLUGIN

installs a plugin into the CLI

PLUGIN  plugin to install

Example:
    $ heroku plugins:install heroku-production-status

`

    test('shows help for plugins', async function () {
      let {stdout} = await run(['plugins', '--help'])
      let {stdout: stdout2} = await run(['plugins', '-h'])
      expect(stdout).toEqual(pluginsHelpOutput)
      expect(stdout2).toEqual(pluginsHelpOutput)
    })

    test('shows help for plugins (prefixed)', async function () {
      let {stdout} = await run(['--help', 'plugins'])
      let {stdout: stdout2} = await run(['-h', 'plugins'])
      expect(stdout).toEqual(pluginsHelpOutput)
      expect(stdout2).toEqual(pluginsHelpOutput)
    })

    test('shows help for plugins:install', async function () {
      let {stdout} = await run(['plugins:install', 'heroku-sudo', '--help'])
      let {stdout: stdout2} = await run(['plugins:install', 'heroku-sudo', '-h'])
      expect(stdout).toEqual(pluginsInstallHelpOutput)
      expect(stdout2).toEqual(pluginsInstallHelpOutput)
    })

    test('shows help for plugins:install (prefixed)', async function () {
      let {stdout} = await run(['--help', 'plugins:install', 'heroku-sudo'])
      let {stdout: stdout2} = await run(['-h', 'plugins:install', 'heroku-sudo'])
      expect(stdout).toEqual(pluginsInstallHelpOutput)
      expect(stdout2).toEqual(pluginsInstallHelpOutput)
    })
  })
})
