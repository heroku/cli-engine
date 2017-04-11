// @flow

import {type LegacyCommand, convertFromV5} from './legacy'
import Config from 'cli-engine-command/lib/config'

jest.mock('cli-engine-command/lib/heroku', function () {
  let def = function () {
    return {
      auth: '1234'
    }
  }
  def.vars = {
    apiHost: 'api.foo.com',
    apiUrl: 'https://api.foo.com',
    gitHost: 'foo.com',
    httpGitHost: 'git.foo.com'
  }
  return def
})

jest.mock('cli-engine-command/lib/config', function () {
  return function () {
    return {
      debug: 0,
      dirs: {
        cache: '/Users/foo/.cache/heroku'
      }
    }
  }
})

// I would have preferred to mock out Config here but it
// is awkward crossing the cli-engine-command boundary
// and it gets reinstantiated in Command as well making
// mocking out somewhat problematic
test('exports a context', async function () {
  let ctx = {}
  let l: LegacyCommand = {
    topic: 'foo',
    command: 'bar',
    args: [],
    flags: [],
    run: function (context) {
      ctx = context
      return Promise.resolve()
    }
  }

  let V5 = convertFromV5(l)
  let cmd = new V5(new Config())
  cmd.argv = []
  await cmd.run()

  expect(ctx.supportsColor).toEqual(cmd.color.enabled)
  expect(ctx.debug).toEqual(0)
  expect(ctx.apiToken).toEqual('1234')
  expect(ctx.apiHost).toEqual('api.foo.com')
  expect(ctx.apiUrl).toEqual('https://api.foo.com')
  expect(ctx.herokuDir).toEqual('/Users/foo/.cache/heroku')
  expect(ctx.gitHost).toEqual('foo.com')
  expect(ctx.httpGitHost).toEqual('git.foo.com')
  expect(ctx.auth.password).toEqual('1234')
})
