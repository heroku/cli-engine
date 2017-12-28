import { cli } from 'cli-ux'

import { run } from './__test__/run'

jest.setTimeout(60000)

test('runs the version command', async () => {
  const { stdout } = await run(['version'])
  expect(stdout).toMatch(/^cli-engine-example\//)
})

test('errors with invalid arguments', async () => {
  expect.assertions(1)
  try {
    await run(['version', '--invalid-flag'])
  } catch (err) {
    expect(err.message).toMatch(/^Unexpected argument: --invalid-flag/)
  }
})

test('errors when command not found', async () => {
  expect.assertions(2)
  try {
    await run(['foobar12345'])
  } catch (err) {
    expect(cli.stderr.output).toMatch(/foobar12345 is not a cli-engine command./)
    expect(err.code).toEqual(127)
  }
})

describe('edge cases', () => {
  test('shows help for `help` command itself', async () => {
    let { stdout } = await run(['help'])
    expect(stdout).toMatch(/Usage: cli-engine COMMAND/)
  })
})
