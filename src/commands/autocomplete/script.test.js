// @flow

import AutocompleteScript from './script'
import os from 'os'

// autocomplete will throw error on windows
let skipWindows = (os.platform() === 'windows' || os.platform() === 'win32') ? xtest : test

skipWindows.only('outputs autocomplete script for .zshrc', async () => {
  let cmd = await AutocompleteScript.mock('zsh')
  const acpath = AutocompleteScript
  expect(cmd.out.stdout.output).toMatch(/fpath=\(/)
  expect(cmd.out.stdout.output).toMatch(/heroku\/cli-engine\/autocomplete\/zsh/)
})
