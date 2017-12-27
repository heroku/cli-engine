import { run } from '../__test__/run'

test('run commands', async () => {
  expect((await run(['commands'])).stdout).toEqual(`cli:test
commands
help
jobs:start
plugins
plugins:install
plugins:link
plugins:uninstall
plugins:update
update
version
which
`)
})

test('run commands --json', async () => {
  JSON.parse((await run(['commands', '--json'])).stdout)
})
