// @flow

import Output from 'cli-engine-command/lib/output'
import NotFound from './not_found'

test('it exits with 127', async () => {
  expect.assertions(1)
  let output = new Output({mock: true})
  let nf = new NotFound(output, ['heroku', 'foo'])
  try {
    await nf.run()
  } catch (err) {
    expect(err.code).toEqual(127)
  }
})
