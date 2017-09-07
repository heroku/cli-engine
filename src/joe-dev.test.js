// @flow

import CLI from './cli'

jest.unmock('fs-extra')

jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000

async function run (...argv: string[]) {
  let config = {
    ...global.joeDevConfig,
    argv: ['joe-dev'].concat(argv),
    mock: true
  }
  let cli = new CLI({config})
  try {
    await cli.run()
  } catch (err) {
    if (err.code !== 0) throw err
  }
  return cli.cmd
}

test('shows version', async () => {
  let {stdout} = await run('version')
  expect(stdout).toMatch(/^joe-dev-cli/)
})

test('shows help', async () => {
  let {stdout} = await run('help')
  expect(stdout).toMatch(/^Usage: joe-dev-cli/)
})
