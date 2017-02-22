// @flow
/* globals
   test
 */

import CLI from './cli'

test('runs the version command', async function () {
  let cli = new CLI({argv: ['heroku', 'version']})
  await cli.run()
})
