// @flow

import AutocompletePath from './path'
import os from 'os'

// autocomplete will throw error on windows
let skipWindows = (os.platform() === 'windows' || os.platform() === 'win32') ? xtest : test

skipWindows('outputs commands file path', async () => {
  let cmd = await AutocompletePath.mock()
  expect(cmd.out.stdout.output).toMatch(/cache/i)
  expect(cmd.out.stdout.output).toMatch(/\/cli-engine\/completions\/commands\n/)
})
