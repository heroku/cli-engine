// @flow

import Which from './which'
import Plugins from '../plugins'
import Config from 'cli-engine-command/lib/config'
import Output from 'cli-engine-command/lib/output'

function plugins () {
  let config = new Config({mock: true})
  let output = new Output(config)
  return new Plugins(output)
}

async function install (plugin) {
  await plugins().install(plugin)
}

jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000

test('finds a plugin command', async () => {
  await install('heroku-debug')
  let cmd = await Which.run(['debug'], {mock: true})
  expect(cmd.stdout.output).toContain('heroku-debug')
})

test('finds a builtin command', async () => {
  let cmd = await Which.run(['update'], {mock: true})
  expect(cmd.stdout.output).toContain('builtin')
})
