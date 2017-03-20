// @flow

const FS = require('fs')
import { default as OS } from 'os'
import Config from 'cli-engine-command'
const HTTPS = require('https')
const Path = require('path')

// class AnalyticsBody {
//   schema: int
//   commands: Array
//   user: string
// }
//
// let currentAnalyticsCommand = new AnalyticsCommand()
// currentAnalyticsCommand.timestamp = Date().now
// currentAnalyticsCommand.os = OS.platform()
// currentAnalyticsCommand.arch = OS.arch()
// currentAnalyticsCommand.language = 'javascript'
// currentAnalyticsCommand.valid = true

// AnalyticsCommand represents an analytics command
export  class AnalyticsCommand {
  command: string
  plugin: string
  pluginVersion: string
  version: string
  os: string
  arch: string
  status: number
  start: any
  analyticsPath: string //= Path.join(CacheHome, "analytics.json")
  constructor (command: string, plugin: string, pluginVersion: string, version: string, config: Config) {
    this.command = command
    this.plugin = plugin
    this.pluginVersion = pluginVersion
    this.version = version
    this.analyticsPath = "  "
    this.os = OS.platform()
    this.arch = OS.arch()
    this.config = config
  }

  recordStart () {
    //TODO: add version stuff here
    // this.version = version
    this.start = Date.now()
  }

  recordEnd (status: number) {
    if (AnalyticsCommand.skipAnalytics() || process.argv.length < 2 || (this.Valid && this.start.IsZero())) {
      return
    }
    this.command = process.argv[1]
    //TODO: convert this
    // this.status = status
    // if (!this.start.IsZero()) {
    //   this.runtime = (time.Now().UnixNano() - this.start.UnixNano()) / 1000000
    // }
    // file = this.readAnalyticsFile()
    // file.commands = append(file.commands, this)
    // this.LogIfError(writeAnalyticsFile(file))
  }

  static async submitAnalytics() {
    if(AnalyticsCommand.skipAnalytics()) return
    console.log("SANITY CHECK: made it into submitAnalytics")
    let host = process.env['HEROKU_ANALYTICS_HOST']
    host = host || "https://cli-analytics.heroku.com"
    let options = {
      hostname: host,
      port: 433,
      path: '/record',
      method: 'POST',
      headers: {
        'User-Agent': 3
      }
    }
    await HTTPS.request(options)

  }
//   // return process.env["TESTING"] === ONE || (config.SkipAnalytics !== null && config.SkipAnalytics) || netrcLogin() == ""
  static skipAnalytics() {
    console.log("SANITY CHECK: skipAnalytics is not a mock")
    return (process.env['TESTING'].match(/[\w]+/) ? true : false) || this.config.skipAnalytics === true
  }
}

//
//
// let writeAnalyticsFile = function (analyticsBody: AnalyticsBody) {
//   FS.writeFileSync(analyticsBody.toString())
// }
//
// let submitAnalytics = function () {
//   if (skipAnalytics()) return
//   let fileData = FS.readFileSync(analyticsPath, "utf8")
//   //TODO: netrc login stuff
//   let host = process.env['HEROKU_ANALYTICS_HOST']
//   host = host || "https://cli-analytics.heroku.com"
//   let options = {
//     hostname: host,
//     port: 443,
//     path: '/record',
//     method: 'POST',
//     headers: {
//       'User-Agent': version()
//     }
//   }
//   HTTPS.request(options, (err, data) => {
//     if (err) {
//       log.error(err)
//       throw err
//     }
//     /* something something here */
//     FS.writeFileSync()
//   })
// }
//
// function skipAnalytics () {
//   // return process.env["TESTING"] === ONE || (config.SkipAnalytics !== null && config.SkipAnalytics) || netrcLogin() == ""
// }
