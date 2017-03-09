// @flow

import Link from './link'
import Index from './index'
import Uninstall from './uninstall'

beforeEach(() => {
  jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000
})

test('links example plugin', async () => {
  let index = new Index({mock: true})
  await index._run()
  if (index.stdout.output.includes('cli-engine-example-plugin')) {
    let uninstall = new Uninstall({mock: true, argv: ['cli-engine', 'uninstall', 'cli-engine-example-plugin']})
    await uninstall._run()
  }
  let link = new Link({mock: true, argv: ['cli-engine', 'link', './example-plugin']})
  await link._run()
  index = new Index({mock: true})
  await index._run()
  expect(index.stdout.output).toContain('cli-engine-example-plugin')
})
