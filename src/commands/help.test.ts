import { run } from '../../test/run'

test('shows help by default', async () => {
  const { stdout } = await run()
  expect(stdout).toEqual(`Usage: cli-engine COMMAND

Help topics, type cli-engine help TOPIC for more details:

 plugins  add/remove CLI plugins

`)
})

test('run help plugins', async () => {
  const { stdout } = await run(['help', 'plugins'])
  expect(stdout).toEqual(`Usage: cli-engine plugins [flags]

list installed plugins

Flags:
 --core  show core plugins

Example:
    $ heroku plugins
    heroku-ci 1.8.0
    heroku-cli-status 3.0.10
    heroku-fork 4.1.22

cli-engine plugins commands: (get help with cli-engine help plugins:COMMAND)

 plugins:install PLUGIN...  installs a plugin into the CLI
 plugins:link [PATH]        links a local plugin to the CLI for development
 plugins:uninstall PLUGIN   uninstalls or unlinks a plugin
 plugins:update             update installed plugins

`)
})

test('run help plugins:install', async () => {
  const { stdout } = await run(['help', 'plugins:install'])
  expect(stdout).toEqual(`Usage: cli-engine plugins:install PLUGIN... [flags]

installs a plugin into the CLI

Aliases:
  $ cli-engine plugins:unlink

PLUGIN  plugin to install

Flags:
 -f, --force

Example:
    $ heroku plugins:install heroku-production-status

`)
})

test('run version --help', async () => {
  const { stdout } = await run(['version', '--help'])
  expect(stdout).toEqual(`Usage: cli-engine version

show CLI version

Aliases:
  $ cli-engine -v
  $ cli-engine --version

`)
})

test('run version -h', async () => {
  const { stdout } = await run(['version', '-h'])
  expect(stdout).toEqual(`Usage: cli-engine version

show CLI version

Aliases:
  $ cli-engine -v
  $ cli-engine --version

`)
})

test('run version help', async () => {
  const { stdout } = await run(['version', 'help'])
  expect(stdout).toEqual(`Usage: cli-engine version

show CLI version

Aliases:
  $ cli-engine -v
  $ cli-engine --version

`)
})
