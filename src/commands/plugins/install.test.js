// @flow
/* globals
   test
   expect
   jasmine
   beforeEach
*/

import Install from './install'
import Index from './index'

beforeEach(() => {
  jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000
})

test('installs heroku-debug', async () => {
  const install = new Install({mock: true, argv: ['cli-engine', 'install', 'heroku-debug']})
  await install._run()
  const index = new Index({mock: true})
  await index._run()
  expect(index.stdout.output).toContain('heroku-debug')
})
