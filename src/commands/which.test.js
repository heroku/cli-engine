// @flow

import Which from './which'

test('finds a plugin command', async () => {
  let cmd = await Which.run(['cli:test'], {mock: true})
  expect(cmd.stdout.output).toContain('cli-engine-example-plugin')
})

test('finds a builtin command', async () => {
  let cmd = await Which.run(['update'], {mock: true})
  expect(cmd.stdout.output).toContain('builtin')
})
