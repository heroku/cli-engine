import * as nock from 'nock'

import { run } from '../__test__/run'

let api = nock('https://status.heroku.com:443')

beforeEach(() => nock.cleanAll())
afterEach(() => api.done())

jest.setTimeout(120000)

test('installs heroku-cli-status', async () => {
  // uninstall plugin if needed
  await run(['plugins:uninstall', 'heroku-cli-status']).catch(() => {})

  // ensure plugin is gone
  expect((await run(['plugins'])).stdout).not.toContain('heroku-cli-status')

  // install plugin
  await run(['plugins:install', 'heroku-cli-status'])

  // check for plugin
  expect((await run(['plugins'])).stdout).toContain('heroku-cli-status')

  // get plugin's help
  expect((await run(['help'])).stdout).toMatch(/status.*status of the Heroku platform/)
  expect((await run(['help', 'status'])).stdout).toContain('display current status of the Heroku platform')

  // run plugin
  api.get('/api/v4/current-status').reply(200, {
    status: [
      { system: 'Apps', status: 'green' },
      { system: 'Data', status: 'green' },
      { system: 'Tools', status: 'green' },
    ],
    incidents: [],
    scheduled: [],
  })
  expect((await run(['status'])).stdout).toMatch(/Apps: +No known issues at this time./)

  // uninstall plugin
  await run(['plugins:uninstall', 'heroku-cli-status'])

  // ensure plugin is gone
  expect((await run(['plugins'])).stdout).not.toContain('heroku-cli-status')

  // ensure plugin help is gone
  expect((await run(['help'])).stdout).not.toContain('status')
  await expect(run(['help', 'status'])).rejects.toThrow(/Exited with code: 127/)
})
