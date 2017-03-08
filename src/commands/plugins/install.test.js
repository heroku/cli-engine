// @flow
/* globals
   test
   expect
   jasmine
*/

import Install from './install'
import Index from './index'

test('installs heroku-debug', async () => {
  jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000
  const install = new Install({mock: true, argv: ['cli-engine', 'install', 'heroku-debug']})
  await install._run()
  const index = new Index({mock: true})
  await index._run()
  expect(index.stdout.output).toContain('heroku-debug')
})
