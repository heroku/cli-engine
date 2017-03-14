// @flow

import {Config} from 'cli-engine-command'
import NotFound from './not_found'

test('it exits with 127', async () => {
  expect.assertions(1)
  let config = new Config({argv: ['heroku', 'foo'], mock: true})
  let nf = new NotFound(config)
  try {
    await nf.run()
  } catch (err) {
    expect(err.code).toEqual(127)
  }
})
