// @flow

import Command from './help'

test('shows the topics', async function () {
  let cmd = await Command.mock()
  expect(cmd.out.stdout.output).toMatch(/^ plugins +# manage plugins$/m)
})

test('shows help about plugins', async function () {
  let cmd = await Command.mock('plugins')
  expect(cmd.out.stdout.output).toMatch(/^ +plugins:install PLUGIN +# installs a plugin into the CLI$/m)
})
