// @flow

import Command from './help'

import {buildConfig} from 'cli-engine-config'
import Output from 'cli-engine-command/lib/output'

const path = require('path')
const fs = require('fs-extra')

jest.unmock('fs-extra')

function mockOutput () {
  let testDir = path.join(path.dirname(__filename), '..', '..', 'test')
  let root = path.join(testDir, 'roots', 'test-foo')
  let pjson = fs.readJSONSync(path.join(root, 'package.json'))
  let config = buildConfig({root, pjson})

  return new Output({config, mock: true})
}

test('shows the topics', async function () {
  let cmd = await Command.mock()
  expect(cmd.out.stdout.output).toMatch(/^ plugins +# manage plugins$/m)
})

test('shows help about plugins', async function () {
  let cmd = await Command.mock('plugins')
  expect(cmd.out.stdout.output).toMatch(/^ +plugins:install PLUGIN +# installs a plugin into the CLI$/m)
})

test('help should show usage in topics', async () => {
  let cmd = await Command.run({argv: ['foo'], output: mockOutput()})
  expect(cmd.out.stdout.output).toMatch(/^ fuzz:bar \[FUZZ|BAR\] # usage description$/m)
})

test('help should show usage in commands', async () => {
  let cmd = await Command.run({argv: ['foo:usage'], output: mockOutput()})
  expect(cmd.out.stdout.output).toMatch(/^ fuzz:bar \[FUZZ|BAR\]$/m)
})
