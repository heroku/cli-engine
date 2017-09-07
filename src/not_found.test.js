// @flow

const run = require('../test/run').example

jest.unmock('fs-extra')

test('it exits with 127', async () => {
  let {stderr} = await run(['abc123'], {code: 127})
  expect(stderr).toMatch(/ +abc123 is not a cli-engine command.\n/)
})
