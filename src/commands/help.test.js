// @flow

import Command from './help'

test('shows the topics', async function() {
  let cmd = await Command.run({ argv: ['help'], mock: true })
  expect(cmd.out.stdout.output).toMatch(/^ plugins +manage plugins$/m)
})

test('shows help about plugins', async function() {
  let cmd = await Command.run({ argv: ['help', 'plugins'], mock: true })
  expect(cmd.out.stdout.output).toMatch(/^ +plugins:install PLUGIN +installs a plugin into the CLI$/m)
})

test('help should show usage in topics', async () => {
  let cmd = await Command.run({ ...global.testFooConfig, argv: ['help', 'foo'], mock: true })
  expect(cmd.out.stdout.output).toMatch(/^ fuzz:bar \[FUZZ|BAR\] # usage description$/m)
})

test('help should show usage in commands', async () => {
  let cmd = await Command.run({ ...global.testFooConfig, argv: ['help', 'foo:usage'], mock: true })
  expect(cmd.out.stdout.output).toMatch(/^ fuzz:bar \[FUZZ|BAR\]$/m)
})
