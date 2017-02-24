// @flow
/* globals
   test
   expect
*/

import Install from './install'
import Index from './index'

test.only('installs heroku-debug', async () => {
  const install = new Install({mock: true, argv: ['cli-engine', 'install', 'heroku-debug']})
  await install._run()
  const index = new Index({mock: true})
  await index._run()
  expect(index.stdout.output).toContain('heroku-debug')
})
