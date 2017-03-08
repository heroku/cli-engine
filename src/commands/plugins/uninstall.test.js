// @flow
/* globals
   test
   expect
   jasmine
   beforeEach
*/

import Install from './install'
import Uninstall from './uninstall'
import Index from './index'

beforeEach(() => {
  jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000
})

test('installs and uninstalls heroku-debug', async () => {
  const install = new Install({mock: true, argv: ['cli-engine', 'install', 'heroku-debug']})
  await install._run()

  let index = new Index({mock: true})
  await index._run()
  expect(index.stdout.output).toContain('heroku-debug')

  const uninstall = new Uninstall({mock: true, argv: ['cli-engine', 'uninstall', 'heroku-debug']})
  await uninstall._run()

  index = new Index({mock: true})
  await index._run()
  expect(index.stdout.output).not.toContain('heroku-debug')
})
