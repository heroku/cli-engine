// @flow

import Which from './which'
import Plugins from '../plugins'
import {Config} from 'cli-engine-command'

function plugins () {
  return new Plugins(new Config({mock: true}))
}

async function install (plugin) {
  await plugins().install(plugin)
}

test('finds a plugin command', async () => {
  jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000
  await install('heroku-debug')
  let cmd = await Which.run(['debug'], {mock: true})
  expect(cmd.stdout.output).toContain('heroku-debug')
})

test('finds a builtin command', async () => {
  let cmd = await Which.run(['update'], {mock: true})
  expect(cmd.stdout.output).toContain('builtin')
})
