// @flow

import Install from './install'
import Uninstall from './uninstall'
// import Link from './uninstall'
// import Update from './update'
import Index from './index'

beforeEach(() => {
  jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000
})

async function plugins (): Promise<string> {
  const index = await Index.run([], {mock: true})
  return index.stdout.output
}

// async function link (plugin: string) {
//   await Link.run([plugin], {mock: true})
// }

async function install (plugin: string) {
  await Install.run([plugin], {mock: true})
}

async function uninstall (plugin: string) {
  await Uninstall.run([plugin], {mock: true})
}

test.skip('updates heroku-debug', async () => {
  let plugin = 'heroku-debug'
  if ((await plugins()).includes(plugin)) await uninstall(plugin)
  await install(plugin)
  await uninstall(plugin)
})
