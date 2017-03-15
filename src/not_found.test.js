// @flow

import Config from 'cli-engine-command/lib/config'
import Output from 'cli-engine-command/lib/output'
import NotFound from './not_found'

test('it exits with 127', async () => {
  expect.assertions(1)
  let config = new Config({argv: ['heroku', 'foo'], mock: true})
  let output = new Output(config)
  let nf = new NotFound(output)
  try {
    await nf.run()
  } catch (err) {
    expect(err.code).toEqual(127)
  }
})
