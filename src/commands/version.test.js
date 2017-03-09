// @flow

import Command from './version'

test('shows the version', async function () {
  let cmd = new Command({argv: ['cli-engine', 'version'], mock: true})
  await cmd._run()
  expect(cmd.stdout.output).toMatch(/^cli-engine/)
})
