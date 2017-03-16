// @flow

import Install from './install'
import Uninstall from './uninstall'
import Index from './index'
import {integrationLock} from '../../../test/helpers'

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000

let unlock
beforeEach(async () => { unlock = await integrationLock() })
afterEach(() => unlock())

async function plugins (): Promise<string> {
  const index = await Index.run([], {mock: true})
  return index.stdout.output
}

async function install (plugin: string) {
  await Install.run([plugin], {mock: true})
}

async function uninstall (plugin: string) {
  await Uninstall.run([plugin], {mock: true})
}

test('installs and uninstalls heroku-debug', async () => {
  let plugin = 'heroku-debug'
  if ((await plugins()).includes(plugin)) await uninstall(plugin)
  await install(plugin)
  await uninstall(plugin)
})
