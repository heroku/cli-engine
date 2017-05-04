// @flow

import CLI from './cli'

jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000

async function run (...argv: string[]) {
  let cli = new CLI({argv: ['heroku'].concat(argv), mock: true})
  try {
    await cli.run()
    return cli
  } catch (err) {
    if (err.code !== 0) throw err
    return cli
  }
}

test('runs the version command', async function () {
  expect.assertions(1)
  let cli = new CLI({argv: ['heroku', 'version'], mock: true})
  try {
    await cli.run()
  } catch (err) {
    expect(err.code).toBe(0)
  }
})

test('errors with invalid arguments', async function () {
  expect.assertions(1)
  let cli = new CLI({argv: ['heroku', 'version', '--invalid-flag'], mock: true})
  try {
    await cli.run()
  } catch (err) {
    expect(err.message).toContain('Unexpected argument --invalid-flag')
  }
})

test('errors when command not found', async function () {
  expect.assertions(1)
  let cli = new CLI({argv: ['heroku', 'foobar12345'], mock: true})
  try {
    await cli.run()
  } catch (err) {
    expect(err.code).toEqual(127)
  }
})

describe('edge cases', () => {
  test('shows help for `help` command itself', async function () {
    let cli = await run('help')
    expect(cli.cmd.out.stdout.output).toMatch(/^Usage: cli-engine COMMAND/)
  })

  test.skip('shows help if present before `--`', async function () {
    let cli = await run('-h', '-a', 'rbriggs-sushi', '--', 'man', '-h')
    expect(cli.cmd.out.stdout.output).toMatch(/^Usage: /m)
  })

  test.skip('ignores help if present after `--`', async function () {
    let cli = await run('-a', 'rbriggs-sushi', '--', 'man', '-h')
    expect(cli.cmd.out.stdout.output).toMatch(/^man, version/m)
  })
})

describe('cli help', () => {
  describe('global help', () => {
    let globalHelpOutput = /^Usage: \S+ COMMAND \[--app APP] \[command-specific-options]$/m

    test('shows help when no arguments given', async function () {
      let cli = await run()
      expect(cli.cmd.out.stdout.output).toMatch(globalHelpOutput)
    })

    test('shows help for `help` command and no additonal arguments', async function () {
      let cli = await run('help')
      expect(cli.cmd.out.stdout.output).toMatch(globalHelpOutput)
    })

    test('shows help for `--help` or `-h` flag and no additonal arguments', async function () {
      let cli = await run('--help')
      let clid = await run('-h')
      expect(cli.cmd.out.stdout.output).toMatch(globalHelpOutput)
      expect(clid.cmd.out.stdout.output).toMatch(globalHelpOutput)
    })
  })

  describe('--help & -h flags', () => {
    let pluginsHelpOutput = /^Usage: \S+ plugins\n\s+--core\n\s+\S+ plugins commands: \(\S+ help plugins:COMMAND for details\)$/m
    let pluginsInstallHelpOutput = /^Usage: \S+ plugins:install PLUGIN\n\s+installs a plugin into the CLI\n\s+Example:$/m

    test('shows help for plugins', async function () {
      let cli = await run('plugins', '--help')
      let clid = await run('plugins', '-h')
      expect(cli.cmd.out.stdout.output).toMatch(pluginsHelpOutput)
      expect(clid.cmd.out.stdout.output).toMatch(pluginsHelpOutput)
    })

    test('shows help for plugins (prefixed)', async function () {
      let cli = await run('--help', 'plugins')
      let clid = await run('-h', 'plugins')
      expect(cli.cmd.out.stdout.output).toMatch(pluginsHelpOutput)
      expect(clid.cmd.out.stdout.output).toMatch(pluginsHelpOutput)
    })

    test('shows help for plugins:install', async function () {
      let cli = await run('plugins:install', 'heroku-sudo', '--help')
      let clid = await run('plugins:install', 'heroku-sudo', '-h')
      expect(cli.cmd.out.stdout.output).toMatch(pluginsInstallHelpOutput)
      expect(clid.cmd.out.stdout.output).toMatch(pluginsInstallHelpOutput)
    })

    test('shows help for plugins:install (prefixed)', async function () {
      let cli = await run('--help', 'plugins:install', 'heroku-sudo')
      let clid = await run('-h', 'plugins:install', 'heroku-sudo')
      expect(cli.cmd.out.stdout.output).toMatch(pluginsInstallHelpOutput)
      expect(clid.cmd.out.stdout.output).toMatch(pluginsInstallHelpOutput)
    })
  })
})
