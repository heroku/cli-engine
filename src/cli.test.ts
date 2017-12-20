import { cli } from 'cli-ux'
import { run } from './cli'

export interface IRootRun {
  code: number
  stdout: string
  stderr: string
}

export async function example(argv: string[]): Promise<IRootRun> {
  let code = 0
  argv = ['cli-engine', ...argv]
  await run({ config: { argv } })
  return {
    stdout: cli.stdout.output,
    stderr: cli.stderr.output,
    code,
  }
}

test('runs the version command', async function() {
  const { stdout } = await example(['version'])
  expect(stdout).toMatch(/^cli-engine\//)
})

test('errors with invalid arguments', async function() {
  expect.assertions(1)
  try {
    await example(['version', '--invalid-flag'])
  } catch (err) {
    expect(err.message).toMatch(/^Unexpected argument: --invalid-flag/)
  }
})

test('errors when command not found', async function() {
  expect.assertions(2)
  try {
    await example(['foobar12345'])
  } catch (err) {
    expect(cli.stderr.output).toMatch(/foobar12345 is not a cli-engine command./)
    expect(err.code).toEqual(127)
  }
})

describe('edge cases', () => {
  test.skip('shows help for `help` command itself', async function() {
    let { stdout } = await example(['help'])
    expect(stdout).toMatch(/Usage: cli-engine COMMAND/)
  })
})

// describe('cli help', () => {
//   describe('global help', () => {
//     let globalHelpOutput = /^Usage: \S+ COMMAND/m

//     test('shows help when no arguments given', async function () {
//       let cli = await run()
//       expect(cli.cmd.out.stdout.output).toMatch(globalHelpOutput)
//     })

//     test('shows help for `help` command and no additonal arguments', async function () {
//       let cli = await run('help')
//       expect(cli.cmd.out.stdout.output).toMatch(globalHelpOutput)
//     })

//     test('shows help for `--help` or `-h` flag and no additonal arguments', async function () {
//       let cli = await run('--help')
//       let clid = await run('-h')
//       expect(cli.cmd.out.stdout.output).toMatch(globalHelpOutput)
//       expect(clid.cmd.out.stdout.output).toMatch(globalHelpOutput)
//     })
//   })

//   describe('--help & -h flags', () => {
//     let pluginsHelpOutput = `Usage: cli-engine plugins [flags]

// list installed plugins

// Flags:
//  --core  show core plugins

// Example:
//     $ cli-engine plugins
//     heroku-ci 1.8.0
//     heroku-cli-status 3.0.10
//     heroku-fork 4.1.22

// cli-engine plugins commands: (get help with cli-engine help plugins:COMMAND)
//  plugins                   list installed plugins
//  plugins:install PLUGIN    installs a plugin into the CLI
//  plugins:link [PATH]       links a local plugin to the CLI for development
//  plugins:uninstall PLUGIN  uninstalls or unlinks a plugin
//  plugins:update            update installed plugins

// `
//     let pluginsInstallHelpOutput = `Usage: cli-engine plugins:install PLUGIN

// installs a plugin into the CLI

// PLUGIN  plugin to install

// Example:
//     $ cli-engine plugins:install heroku-production-status

// `

//     test('shows help for plugins', async function () {
//       let cli = await run('plugins', '--help')
//       let clid = await run('plugins', '-h')
//       expect(cli.cmd.out.stdout.output).toEqual(pluginsHelpOutput)
//       expect(clid.cmd.out.stdout.output).toEqual(pluginsHelpOutput)
//     })

//     test('shows help for plugins (prefixed)', async function () {
//       let cli = await run('--help', 'plugins')
//       let clid = await run('-h', 'plugins')
//       expect(cli.cmd.out.stdout.output).toEqual(pluginsHelpOutput)
//       expect(clid.cmd.out.stdout.output).toEqual(pluginsHelpOutput)
//     })

//     test('shows help for plugins:install', async function () {
//       let cli = await run('plugins:install', 'heroku-sudo', '--help')
//       let clid = await run('plugins:install', 'heroku-sudo', '-h')
//       expect(cli.cmd.out.stdout.output).toEqual(pluginsInstallHelpOutput)
//       expect(clid.cmd.out.stdout.output).toEqual(pluginsInstallHelpOutput)
//     })

//     test('shows help for plugins:install (prefixed)', async function () {
//       let cli = await run('--help', 'plugins:install', 'heroku-sudo')
//       let clid = await run('-h', 'plugins:install', 'heroku-sudo')
//       expect(cli.cmd.out.stdout.output).toEqual(pluginsInstallHelpOutput)
//       expect(clid.cmd.out.stdout.output).toEqual(pluginsInstallHelpOutput)
//     })
//   })
// })
