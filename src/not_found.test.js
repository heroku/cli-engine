// @flow

import Output from 'cli-engine-command/lib/output'
import NotFound from './not_found'

jest.unmock('fs-extra')

test('it exits with 127', async () => {
  expect.assertions(2)
  let output = new Output({mock: true})
  let nf = new NotFound(output, ['heroku', 'foo'])
  try {
    await nf.run()
  } catch (err) {
    if (!err.code) throw err
    expect(err.code).toEqual(127)
    expect(output.stderr.output).toMatch(/ +foo is not a cli-engine command.\n/)
  }
})
