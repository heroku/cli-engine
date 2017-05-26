// @flow

import fs from 'fs-extra'
import type {Config} from 'cli-engine-config'
import Command from 'cli-engine-command'
import HTTP from 'cli-engine-command/lib/http'
import Netrc from 'netrc-parser'
import Output from 'cli-engine-command/lib/output'
import path from 'path'
import Plugins from './plugins'
import {vars} from 'cli-engine-command/lib/heroku'

type AnalyticsJSONCommand = {
  command: string,
  version: string,
  plugin_version: string,
  os: string,
  language: string,
  valid: true
}

type AnalyticsJSON = {
  schema: 1,
  commands: AnalyticsJSONCommand[]
}

type Options = {
  out: Output,
  config: Config,
  plugins: Plugins
}

type AnalyticsJSONPost = {
  schema: 1,
  commands: AnalyticsJSONCommand[],
  user: string
}

export default class AnalyticsCommand {
  out: Output
  plugins: Plugins
  config: Config
  http: HTTP

  constructor (options: Options) {
    this.out = options.out
    this.plugins = options.plugins
    this.http = new HTTP(this.out)
    this.config = options.config
  }

  _initialAnalyticsJSON () : AnalyticsJSON {
    return {
      schema: 1,
      commands: []
    }
  }

  record (Command: Class<Command<*>>) {
    try {
      let plugin = this.plugins.list().find(p => p.findCommand(Command.id))
      if (!plugin) {
        this.out.debug('no plugin found for analytics')
        return
      }

      if (!this.user) return

      let analyticsJSON
      if (this._existsJSON()) {
        try {
          analyticsJSON = this._readJSON()
        } catch (err) {
          this.out.debug(err)
        }
      }

      if (!analyticsJSON) {
        analyticsJSON = this._initialAnalyticsJSON()
      }

      analyticsJSON.commands.push({
        command: Command.id,
        version: this.config.version,
        plugin: plugin.name,
        plugin_version: plugin.version,
        os: this.config.platform,
        valid: true,
        language: 'node'
      })

      this._writeJSON(analyticsJSON)
    } catch (err) {
      this.out.debug(err)
    }
  }

  async submit () {
    try {
      let user = this.user
      if (!user) return

      const local: AnalyticsJSON = this._readJSON()
      if (local.commands.length === 0) return

      const body: AnalyticsJSONPost = {
        schema: local.schema,
        commands: local.commands,
        user: user,
        install: this.config.install,
        cli: this.config.name
      }

      await this.http.post(this.url, {body})

      local.commands = []
      this._writeJSON(local)
    } catch (err) {
      this.out.debug(err)
      this._writeJSON(this._initialAnalyticsJSON())
    }
  }

  get url (): string {
    return process.env['CLI_ENGINE_ANALYTICS_URL'] || 'https://cli-analytics.heroku.com/record'
  }

  get analyticsPath (): string { return path.join(this.config.cacheDir, 'analytics.json') }

  get usingHerokuAPIKey (): boolean {
    return !!(process.env['HEROKU_API_KEY'] && process.env['HEROKU_API_KEY'].length > 0)
  }

  get netrcLogin (): ?string {
    let netrc = new Netrc()
    return netrc.machines[vars.apiHost].login
  }

  get user (): ?string {
    if (this.config.skipAnalytics || this.usingHerokuAPIKey) return
    return this.netrcLogin
  }

  _existsJSON (): boolean {
    return fs.existsSync(this.analyticsPath)
  }

  _readJSON (): AnalyticsJSON {
    return fs.readJSONSync(this.analyticsPath)
  }

  _writeJSON (analyticsJSON: AnalyticsJSON) {
    return fs.writeJSONSync(this.analyticsPath, analyticsJSON)
  }
}
