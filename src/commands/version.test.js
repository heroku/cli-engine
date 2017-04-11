// @flow

import Command from './version'

test('shows the version', async function () {
  let cmd = await Command.mock()
  expect(cmd.out.stdout.output).toMatch(/^cli-engine/)
})
