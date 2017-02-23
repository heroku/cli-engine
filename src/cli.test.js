// @flow
/* globals
   test
   expect
 */

import CLI from './cli'

test('runs the version command', async function () {
  expect.assertions(1)
  let cli = new CLI({argv: ['heroku', 'version'], mock: true})
  await cli._run().catch(err => expect(err.code).toBe(0))
})
