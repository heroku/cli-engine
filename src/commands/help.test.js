// @flow

import Command from './help'

test('shows the topics', async function () {
  let cmd = new Command({mock: true})
  await cmd._run()
  expect(cmd.stdout.output).toMatch(/^ plugins +# manage plugins$/m)
})

test('shows help about plugins', async function () {
  let cmd = new Command({argv: ['cli-engine', 'help', 'plugins'], mock: true})
  await cmd._run()
  expect(cmd.stdout.output).toMatch(/^ +plugins:install PLUGIN +# installs a plugin into the CLI$/m)
})
