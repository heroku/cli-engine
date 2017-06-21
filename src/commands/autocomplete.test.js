// @flow

import Autocomplete from './autocomplete'
import os from 'os'

// autocomplete will throw error on windows
let skipWindows = (os.platform() === 'windows' || os.platform() === 'win32') ? xtest : test

skipWindows('outputs commands file path', async () => {
  let cmd = await Autocomplete.mock('--commands')
  expect(cmd.out.stdout.output).toMatch(/client\/node_modules\/cli-engine\/autocomplete\/commands\n/)
})
