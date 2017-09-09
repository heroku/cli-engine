// @flow

import {NotFound} from './not_found'
import {buildConfig} from 'cli-engine-config'

jest.unmock('fs-extra')

const config = buildConfig({mock: true})

test('it exits with 127', async () => {
  expect.assertions(2)
  let nf = new NotFound(config, ['heroku', 'foo'])
  try {
    await nf.run()
  } catch (err) {
    if (!err.code) throw err
    expect(err.code).toEqual(127)
    expect(nf.cli.stderr.output).toMatch(/ +foo is not a cli-engine command.\n/)
  }
})
