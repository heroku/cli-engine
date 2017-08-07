// @flow

import { buildConfig } from 'cli-engine-config'
import Output from 'cli-engine-command/lib/output'
import nock from 'nock'
import Plugins from './plugins'
import AnalyticsCommand from './analytics'

jest.unmock('fs-extra')

function analyticsJson () {
  return {
    schema: 1,
    install: '5a8ef179-1129-4f81-877c-662c89f83f1f',
    cli: 'cli-engine',
    commands: [
      {
        command: 'foo',
        version: '1.2.3',
        plugin_version: '4.5.6',
        os: 'darwin',
        shell: 'fish',
        valid: true
      }
    ]
  }
}

function build (options = {}) {
  let config = options.config || buildConfig({
    version: '1.2.3',
    platform: 'windows',
    skipAnalytics: false,
    install: '5a8ef179-1129-4f81-877c-662c89f83f1f',
    name: 'cli-engine'
  })
  let out = options.out || new Output({config, mock: true})
  let plugins = options.plugins || new Plugins({output: out})

  // flow$ignore
  plugins.list = function () {
    return [{
      name: 'fuzz',
      version: '9.8.7',
      findCommand: function () {
        return true
      }
    }]
  }

  let json = options.json || analyticsJson()

  let command = new AnalyticsCommand({out, config, plugins})

  // flow$ignore
  command._existsJSON = function () {
    return true
  }

  // flow$ignore
  command._readJSON = function () {
    return json
  }

  // flow$ignore
  command._writeJSON = jest.fn()

  // flow$ignore
  Object.defineProperty(command, 'netrcLogin', {
    get: function () {
      if (options.hasOwnProperty('netrcLogin')) {
        // flow$ignore
        return options['netrcLogin']
      }

      return 'foobar@heroku.com'
    }
  })

  return command
}

function cmdId () {
  return 'fuzz:fizz'
}

describe('AnalyticsCommand', () => {
  beforeAll(() => {
    nock.disableNetConnect()
  })

  beforeEach(() => {
    nock.cleanAll()
    delete process.env['HEROKU_API_KEY']
    delete process.env['CLI_ENGINE_ANALYTICS_URL']
  })

  describe('submit', () => {
    it('does not submit if config skipAnalytics is true', async () => {
      let api = nock('https://cli-analytics.heroku.com').post('/record').reply(200, {})

      let config = buildConfig({skipAnalytics: true})
      let command = build({config})

      await command.submit()
      expect(api.isDone()).toBe(false)
    })

    it('does not submit if HEROKU_API_KEY is set', async () => {
      process.env['HEROKU_API_KEY'] = 'secure-key'

      let api = nock('https://cli-analytics.heroku.com').post('/record').reply(200, {})

      await build().submit()
      expect(api.isDone()).toBe(false)
    })

    it('does not submit if login is not set', async () => {
      let api = nock('https://cli-analytics.heroku.com').post('/record').reply(200, {})

      let command = build({netrcLogin: null})

      await command.submit()
      expect(api.isDone()).toBe(false)
    })

    it('does not submit if commands is empty', async () => {
      let api = nock('https://cli-analytics.heroku.com').post('/record').reply(200, {})

      let json = analyticsJson()
      json.commands = []
      let command = build({json})

      await command.submit()
      expect(api.isDone()).toBe(false)
    })

    it('pushes data to the record endpoint', async () => {
      let json = analyticsJson()
      let api = nock('https://cli-analytics.heroku.com').post('/record', json).reply(200, {})

      let command = build({json})

      await command.submit()
      api.done()
    })

    it('clears the local commands after success', async () => {
      let json = analyticsJson()
      let api = nock('https://cli-analytics.heroku.com').post('/record', json).reply(200, {})

      let command = build({json})

      await command.submit()

      let expected = Object.assign({}, json, {commands: []})
      expect(command._writeJSON.mock.calls).toEqual([[expected]])

      api.done()
    })

    it('pushes data to the CLI_ENGINE_ANALYTICS_URL endpoint', async () => {
      process.env['CLI_ENGINE_ANALYTICS_URL'] = 'https://foobar.com/record'
      let json = analyticsJson()
      let api = nock('https://foobar.com').post('/record', json).reply(200, {})

      let command = build({json})

      await command.submit()
      api.done()
    })

    it('traps errors sending to the endpoint', async () => {
      let json = analyticsJson()
      let api = nock('https://cli-analytics.heroku.com').post('/record', json).reply(503, {})

      let command = build({json})

      await command.submit()

      let expected = {
        schema: 1,
        commands: []
      }

      expect(command._writeJSON.mock.calls).toEqual([[expected]])

      api.done()
    })
  })

  describe('record', () => {
    const SHELL = process.env.SHELL

    beforeAll(() => {
      delete process.env.SHELL
      process.env['COMSPEC'] = 'C:\\ProgramFiles\\cmd.exe'
    })

    afterAll(() => {
      delete process.env.COMSPEC
      process.env['SHELL'] = SHELL
    })

    it('does not record if no plugin', async () => {
      let config = buildConfig()
      let out = new Output({config, mock: true})
      let plugins = new Plugins({output: out})

      let command = build({config, out, plugins})
      // flow$ignore
      plugins.list = function () {
        return [{
          findCommand: function () {
            return null
          }
        }]
      }

      await command.record(cmdId())

      expect(command._writeJSON.mock.calls).toEqual([])
    })

    it('does not record if config skipAnalytics is true', async () => {
      let config = buildConfig({skipAnalytics: true})
      let command = build({config})

      await command.record(cmdId())

      expect(command._writeJSON.mock.calls).toEqual([])
    })

    it('does not record if HEROKU_API_KEY is set', async () => {
      process.env['HEROKU_API_KEY'] = 'secure-key'

      let command = build()

      await command.record(cmdId())

      expect(command._writeJSON.mock.calls).toEqual([])
    })

    it('does not record if login is not set', async () => {
      let command = build({netrcLogin: null})

      await command.record(cmdId())

      expect(command._writeJSON.mock.calls).toEqual([])
    })

    it('records commands', async () => {
      let json = analyticsJson()
      let expected = analyticsJson()
      expected.commands.push({
        'command': 'fuzz:fizz',
        'os': 'windows',
        'shell': 'cmd.exe',
        'plugin': 'fuzz',
        'plugin_version': '9.8.7',
        'valid': true,
        'version': '1.2.3',
        'language': 'node'
      })

      let command = build({json})
      await command.record(cmdId())
      expect(command._writeJSON.mock.calls).toEqual([[expected]])
    })
  })
})
