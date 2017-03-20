// @flow

import { default as OS } from 'os'
let AnalyticsCommand = require('./analytics').AnalyticsCommand
import { default as HTTP } from 'https'
import Config from 'cli-engine-command'

let sampleConfig

describe('AnalyticsCommand', () => {
  describe('class scope', () => {
    describe('.submitAnalytics', () => {
      let expectedOptions, originalSkipAnalytics
      beforeAll(() => {
        originalSkipAnalytics = AnalyticsCommand.skipAnalytics
      })
      beforeEach(() => {
        expectedOptions = {
          path: '/record', port: 433, method: 'POST', hostname: 'foo.host',
          headers: {'User-Agent': 3}
          //TODO: put some body stuff here
          // body: /* put some stuff here */

        }
        process.env['HEROKU_ANALYTICS_HOST'] = expectedOptions.hostname
      })
      afterEach(() => {
        AnalyticsCommand.skipAnalytics = originalSkipAnalytics
      })

      test('it does nothing if skipAnalytics returns true', async () => {
        HTTP.request = jest.fn()
        AnalyticsCommand.skipAnalytics = jest.fn(() => { return true })
        await AnalyticsCommand.submitAnalytics()
        expect(HTTP.request).not.toHaveBeenCalled()
      })
      test.skip('pushes data to the "record" endpoint', async () => {
        HTTP.request = jest.fn()
        AnalyticsCommand.skipAnalytics = jest.fn(() => { return false })
        await AnalyticsCommand.submitAnalytics()
        expect(HTTP.request).toHaveBeenCalled()
        expect(HTTP.request).toHaveBeenCalledWith(expectedOptions)
      })
      test('falls back to default URL when HEROKU_ANALYTICS_HOST is not defined', async () => {
        process.env['TESTING'] = ''
        AnalyticsCommand.config = new Config({skipAnalytics: false})
        HTTP.request = jest.fn()
        expectedOptions.hostname = 'https://cli-analytics.heroku.com'
        delete process.env.HEROKU_ANALYTICS_HOST
        await AnalyticsCommand.submitAnalytics()
        expect(HTTP.request).toHaveBeenCalledWith(expectedOptions)
      })
      test('includes the cli version')
      test('uses netrc when available')
      test('it uses the CLI version dynamically')
    })
    describe('skipAnalytics', () => {
      beforeAll(() => {
        sampleConfig = new Config({name: 'analytics'})
      })
      it('returns true when testing environment is true', () => {
        sampleConfig = new Config({name: 'analyitcs', skipAnalytics: false})
        AnalyticsCommand.config = sampleConfig
        process.env['TESTING'] = 'true'
        expect(AnalyticsCommand.skipAnalytics()).toBeTruthy()
        process.env['TESTING'] = ''
        expect(AnalyticsCommand.skipAnalytics()).not.toBeTruthy()
      })
      it('returns true when the config specificies to skip analytics', () => {
        sampleConfig = new Config({name: 'analyitcs', skipAnalytics: true})
        AnalyticsCommand.config = Config
        expect(AnalyticsCommand.skipAnalytics()).not.toBeTruthy()
      })

      it('returns true when there is no netrc login')
    })
  })

  describe('instance scope', () => {
    let analyticsCommand
    beforeEach(() => {
      sampleConfig = new Config({name: 'analytics'})
      analyticsCommand = new AnalyticsCommand('run', 'foo-plugin', '3.5', '6.0')
    })
    test('has an analytics path attribute', async () => {
      expect(analyticsCommand).toHaveProperty('command', 'run')
      expect(analyticsCommand).toHaveProperty('plugin', 'foo-plugin')
      expect(analyticsCommand).toHaveProperty('pluginVersion', '3.5')
      expect(analyticsCommand).toHaveProperty('version', '6.0')
      expect(analyticsCommand).toHaveProperty('start', undefined)
      expect(analyticsCommand).toHaveProperty('analyticsPath')
    })
    describe('constructor', () => {
      describe('assigns', () => {
        test('the command, plugin, pluginVersion, version, and config', () => {
          analyticsCommand = new AnalyticsCommand('run', 'foo-plugin', '3.5', '6.0', sampleConfig)
          expect(analyticsCommand.command).toEqual('run')
          expect(analyticsCommand.plugin).toEqual('foo-plugin')
          expect(analyticsCommand.pluginVersion).toEqual('3.5')
          expect(analyticsCommand.version).toEqual('6.0')
          expect(analyticsCommand.config).toEqual(sampleConfig)
        })
      })
      describe('sets', () => {
        test('the os/platform', () => {
          expect(analyticsCommand).toHaveProperty('os', OS.platform())
        })
        test('the architecture', () => {
          expect(analyticsCommand).toHaveProperty('arch', OS.arch())
        })
        test('the analyticsPath')
      })
    })
    describe('.recordStart', () => {
      it.only('catches the start time and version in a variable in memory', () => {
        analyticsCommand = new AnalyticsCommand(sampleConfig)
        analyticsCommand.recordStart()
        expect(analyticsCommand.start).toBeCloseTo(Date.now(), 5)
      })
    })
    describe('.recordEnd', () => {
      describe('records to the file', () => {
        it('the command name')
        it('the status')
        it('the start time')
        it('the runtime')
      })
    })
  })

  describe('version', () => {
    it('exists somewhere')
  })

  describe('.netrcLogin', () => {
    it('uses the HEROKU_API_KEY env variable')
    it('returns an empty string if there is no HEROKU_API_KEY')
    it('gets the machine from the apiHost variable or function')
  })
})

