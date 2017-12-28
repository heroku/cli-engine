jest.mock('cli-ux')
const cli = require('cli-ux').default

import * as path from 'path'

import * as fs from './file'
import * as validate from './validate'

test('cliPjson', async () => {
  let f = path.join(__dirname, '__test__/fixtures/invalidpjson.json')
  validate.cliPjson(await fs.readJSON(f), f)
  expect(cli.warn.mock.calls[0][0].message).toEqual(`Error reading ${f}:
${f}.cliPjson['cli-engine']: should NOT have additional properties: { additionalProperty: 'invalid' }`)
})
