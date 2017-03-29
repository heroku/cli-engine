// @flow

const FS = require('fs')
import { default as OS } from 'os'
import type Config from 'cli-engine-command/lib/config'
import HTTP from 'cli-engine-command/lib/http'
import Netrc from 'netrc-parser'
import Output from 'cli-engine-command/lib/output'

export default class AnalyticsCommand {
  command: string
  plugin: string
  pluginVersion: string
  version: string
  platform: string
  arch: string
  start: any
  analyticsPath: string //= Path.join(CacheHome, "analytics.json")
  config: Config

  constructor (command: string, plugin: string, pluginVersion: string, config: Config) {
    this.config = config
    this.command = command
    this.plugin = plugin
    this.pluginVersion = pluginVersion
    this.version = this.config.config.version
    this.platform = OS.platform()
    this.arch = OS.arch()
    this.analyticsPath = '~/.local/share/heroku/analytics.json'
  }

  async recordEnd () {
    if (AnalyticsCommand.skipAnalytics() || process.argv.length < 2) {
      return
    }
    let analyticsJSON
    if (FS.existsSync(this.analyticsPath)) {
      let analyticsData = FS.readFileSync(this.analyticsPath, 'utf8')
      analyticsJSON = JSON.parse(analyticsData)
    } else {
      analyticsJSON = {
        'schema': 1,
        'commands': []
      }
    }
    analyticsJSON['commands'].push({
      command: this.command,
      version: this.config.config.version,
      platform: this.platform
    })
    FS.writeFileSync(this.analyticsPath, JSON.stringify(analyticsJSON), 'utf8')
  }

  static async submitAnalytics (config: Config) {
    if (AnalyticsCommand.skipAnalytics()) return
    const analyticsData = FS.readFileSync(this.analyticsPath, 'utf8')
    let host = process.env['HEROKU_ANALYTICS_HOST']
    host = host || 'https://cli-analytics.heroku.com/record'
    let options = {
      port: 443,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: analyticsData
    }
    let out = new Output(config)
    let http = new HTTP(out)
    await http.post(host, options)
  }

  static skipAnalytics () {
    if (process.env['TESTING'] && process.env['TESTING'].match(/[\w]+/)) {
      return true
    }
    else if (this.config && this.config.skipAnalytics && this.config.skipAnalytics === true) {
      return true
    } else if (AnalyticsCommand.netrcLogin() === false) {
      return true
    }
    return false
  }

  static analyticsPath(){

  }

  static async netrcLogin () {
    if (process.env['HEROKU_API_KEY'] !== undefined || process.env['HEROKU_API_KEY'].length > 0) return false
    let netrc = new Netrc()
    return await netrc.machines['api.heroku.com'].login
  }
}

