// @flow

import Install from './install'
import Uninstall from './uninstall'
import Index from './index'

beforeEach(() => {
  jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000
})

async function plugins (): Promise<string> {
  let index = new Index({mock: true})
  await index._run()
  return index.stdout.output
}

async function install (plugin: string) {
  const install = new Install({mock: true, argv: ['cli-engine', 'install', plugin]})
  await install._run()
}

async function uninstall (plugin: string) {
  const uninstall = new Uninstall({mock: true, argv: ['cli-engine', 'uninstall', plugin]})
  await uninstall._run()
}

test('installs and uninstalls heroku-debug', async () => {
  let plugin = 'heroku-debug'
  if ((await plugins()).includes(plugin)) await uninstall(plugin)
  await install(plugin)
  await uninstall(plugin)
})
