// @flow

import {flags} from 'cli-engine-command'
import AutocompleteBase from '.'
import Plugins from '../../plugins'
import ACCache from '../../cache'
import path from 'path'

export default class AutocompleteValues extends AutocompleteBase {
  static topic = 'autocomplete'
  static command = 'values'
  static description = 'generates autocomplete values'
  static hidden = true
  static flags = {
    // don't require cmd or flag
    // we want it to run silently
    // or autocomplete will use any
    // flag errors as options
    cmd: flags.string({description: '', char: 'c'}),
    flag: flags.string({description: '', char: 'f'})
  }

  async run () {
    try {
      this.errorIfWindows()

      if (!this.flags.cmd) this.out.error('Missing required value for --cmd')
      if (!this.flags.flag) this.out.error('Missing required value for --flag')

      const plugins = new Plugins(this.out)
      await plugins.load()
      let Command = await plugins.findCommand(this.flags.cmd)
      if (!Command) this.out.error(`Command ${this.flags.cmd} not found`)
      let long = this.flags.flag.replace(/^-+/, '')
      let flags = Command ? Command.flags : {}
      let flag = flags[long]
      if (!flag) this.out.error(`Flag ${long} not found`)
      if (flag.completion && flag.completion.options) {
        let flagCache = path.join(this.completionsPath, long)
        let duration = flag.completion.cacheDuration || 60 * 60 * 24 // 1 day
        let opts = {cacheFn: () => flag.completion.options(this.out)}
        let options = await ACCache.fetch(flagCache, duration, opts)
        this.out.log((options || []).join('\n'))
      }
    } catch (err) {
      // fail silently
      // or autocomplete will use error as options
      this.out.logError(err)
    }
  }
}
