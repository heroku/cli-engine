// @flow

import Command from './version'

test('shows the version', async function () {
  let cmd = await Command.run([], {mock: true})
  expect(cmd.stdout.output).toMatch(/^cli-engine/)
})
