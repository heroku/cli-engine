// @flow

import Autocomplete from './autocomplete'
import os from 'os'

test('outputs commands file path', async () => {
  // autocomplete will throw error on windows
  if (os.platform() === 'windows') return
  let cmd = await Autocomplete.mock('--commands')
  expect(cmd.out.stdout.output).toMatch(/client\/node_modules\/cli-engine\/autocomplete\/commands\n/)
})
