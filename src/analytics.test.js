// @flow

let AnalyticsCommand = require('./analytics').AnalyticsCommand
import HTTP from 'cli-engine-command/lib/http'
import Config from 'cli-engine-command'
let FS = require('fs')
import nock from 'nock'
import { default as OS } from 'os'
import Netrc from 'netrc-parser'

let sampleConfig

describe('AnalyticsCommand', () => {
  describe('class scope', () => {
    describe.only('.netrcLogin', () => {
      it('returns false, doing nothing, if HEROKU_API_KEY is available', async () => {
        process.env['HEROKU_API_KEY'] = 'secure-key'
        let returnval = await AnalyticsCommand.netrcLogin()
        expect(returnval).toBe(false)
      })
      it('returns false when the netrc login does not exist')
    })
    describe('.submitAnalytics', () => {
      let expectedOptions, originalSkipAnalytics
      beforeAll(() => {
        originalSkipAnalytics = AnalyticsCommand.skipAnalytics
      })
      beforeEach(() => {
        sampleConfig = new Config({name: 'analytics', platform: OS.platform(), version: '6.0'})
        expectedOptions = {
          path: '/record', port: 433, method: 'POST', hostname: 'foo.host',
          headers: {'User-Agent': sampleConfig.version}
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
        let postAnalytics = nock(`http://${expectedOptions.hostname}`).post('/record').reply(200)
        AnalyticsCommand.skipAnalytics = jest.fn(() => { return false })
        await AnalyticsCommand.submitAnalytics()
        expect(postAnalytics.isDone()).toBe(true)
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
      sampleConfig = new Config({name: 'analytics', platform: OS.platform(), version: '6.0'})
      analyticsCommand = new AnalyticsCommand('run', 'foo-plugin', '3.5', sampleConfig)
    })
    test('has an pertinent attributes', async () => {
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
          analyticsCommand = new AnalyticsCommand('run', 'foo-plugin', '3.5', sampleConfig)
          expect(analyticsCommand.command).toEqual('run')
          expect(analyticsCommand.plugin).toEqual('foo-plugin')
          expect(analyticsCommand.pluginVersion).toEqual('3.5')
          expect(analyticsCommand.version).toEqual('6.0')
          expect(analyticsCommand.config).toEqual(sampleConfig)
        })
      })
      describe('sets', () => {
        test('the os/platform', () => {
          expect(analyticsCommand).toHaveProperty('platform', OS.platform())
        })
        test('the architecture', () => {
          expect(analyticsCommand).toHaveProperty('arch', OS.arch())
        })
        test('the analyticsPath')
      })
    })
    describe('.recordStart', () => {
      it('does not exist', () => {
        expect(analyticsCommand).not.toHaveProperty('recordStart')
      })
    })
    describe('.recordEnd', () => {
      describe('records to the file', () => {
        it('writes to whatever #analyticsPath is', async () => {
          if (FS.existsSync('../analytics.json'))
            FS.unlinkSync('../analytics.json')
          await analyticsCommand.recordEnd()
          let analyticsData = FS.readFileSync('../analytics.json', 'utf8')
          let analyticsJSON = JSON.parse(analyticsData)
          let sampleCommand = analyticsJSON['commands'][0]
          expect(sampleCommand).toHaveProperty('command', 'run')
          expect(sampleCommand).toHaveProperty('version', '6.0')
          expect(sampleCommand).toHaveProperty('platform', OS.platform())
        })
      })
    })
  })
})
