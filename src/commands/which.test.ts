import * as path from 'path'

import { run } from '../__test__/run'

const { version } = require(path.join(__dirname, '../../package.json'))

test('run which version', async () => {
  expect((await run(['which', 'version'])).stdout).toEqual(`=== Plugin @cli-engine/engine
version: ${version}\n`)
})

test('run which cli:test', async () => {
  expect((await run(['which', 'cli:test'])).stdout).toContain(`=== Plugin cli-engine-example-plugin
version:`)
})
