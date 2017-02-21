// @flow

import Command from 'cli-engine-command'
import dirs from '../../dirs'
import fs from 'fs-extra'
import yarn from '../../mixins/yarn'
import path from 'path'
import errors from '../../errors'

export default class extends yarn(Command) {
  static topic = 'plugins'
  static command = 'install'
  static description = 'Installs a plugin into the CLI'
  static help = `
  Example:
    $ heroku plugins:install heroku-production-status
  `
  static args = [
    {name: 'plugin'}
  ]

  async run () {
    const plugins = require('../../plugins')
    if (!this.debugging) this.action.start(`Installing plugin ${this.args.plugin}`)
    await this.setupYarn()
    await this.yarn('add', this.args.plugin)
    try {
      // flow$ignore
      let plugin = require(dirs.userPlugin(this.args.plugin))
      if (!plugin.commands) throw new Error(`${this.args.plugin} does not appear to be a Heroku CLI plugin`)
      plugins.clearCache(dirs.userPlugin(this.args.plugin))
    } catch (err) {
      errors.logError(err)
      if (!this.debugging) this.action.start(`ERROR: uninstalling ${this.args.plugin}`)
      this.warn('Run with --debug to see extra information')
      await this.yarn('remove', this.args.plugin)
      throw err
    }
  }

  async setupYarn () {
    const pjson = path.join(dirs.plugins, 'package.json')
    fs.mkdirpSync(dirs.plugins)
    if (!fs.existsSync(pjson)) fs.writeFileSync(pjson, JSON.stringify({private: true}))
    await this.yarn()
  }
}
