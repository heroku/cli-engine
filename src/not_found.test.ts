import cli from 'cli-ux'

import { run } from './__test__/run'

test('shows the not found command', async () => {
  expect.assertions(2)
  try {
    await run(['vursion'])
  } catch (err) {
    expect(err.code).toEqual(127)
    expect(cli.stderr.output).toMatch(/vursion is not a cli-engine command/)
  }
})
