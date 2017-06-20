// @flow

import Autocomplete from './autocomplete'

test('outputs commands file path', async () => {
  let cmd = await Autocomplete.mock('--commands')
  expect(cmd.out.stdout.output).toMatch(/client\/node_modules\/cli-engine\/autocomplete\/commands\n/)
})
