// @flow

import CLI from './cli'

test('runs the version command', async function () {
  expect.assertions(1)
  let cli = new CLI({argv: ['heroku', 'version'], mock: true})
  try {
    await cli.run()
  } catch (err) {
    expect(err.code).toBe(0)
  }
})

test('errors with invalid arguments', async function () {
  expect.assertions(2)
  let cli = new CLI({argv: ['heroku', 'version', '--invalid-flag'], mock: true})
  try {
    await cli.run()
  } catch (err) {
    expect(err.code).toBe(1)
    expect(cli.command.stderr.output).toContain('Unexpected argument --invalid-flag')
  }
})
