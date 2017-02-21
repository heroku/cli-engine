// @flow

import Command from 'cli-engine-command'
import yarn from '../../mixins/yarn'
import dirs from '../../dirs'
import fs from 'fs-extra'

export default class extends yarn(Command) {
  static topic = 'plugins'
  static command = 'uninstall'
  static args = [
    {name: 'plugin'}
  ]
  static aliases = ['plugins:unlink']

  async run () {
    if (!this.debugging) this.action.start(`Uninstalling plugin ${this.args.plugin}`)
    if (fs.existsSync(dirs.userPlugin(this.args.plugin))) {
      await this.yarn('remove', this.args.plugin)
    } else {
      this.plugins.removeLinkedPlugin(this.args.plugin)
    }
    this.plugins.clearCache(dirs.userPlugin(this.args.plugin))
  }

  get plugins () { return require('../../plugins') }
}
