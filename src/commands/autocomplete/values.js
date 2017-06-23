// @flow

import {flags} from 'cli-engine-command'
import HerokuCommand from 'cli-engine-heorku'
import Plugins from '../../plugins'
import ACCache from '../../cache'
import path from 'path'

export default class AutocompleteValues extends HerokuCommand {
  static topic = 'autocomplete'
  static command = 'values'
  static description = 'generates autocomplete values'
  static hidden = true
  static flags = {
    // don't require cmd or flag
    // we want it to fail silently
    // or autocomplete gets weird
    cmd: flags.string({description: '', char: 'c'}),
    flag: flags.string({description: '', char: 'f'})
  }

  async run () {
    if (this.config.windows) {
      this.out.error('Autocomplete is not currently supported in Windows')
      return
    }

    if (this.flags.cmd) {
      const plugins = new Plugins(this.out)
      await plugins.load()
      let Command = await plugins.findCommand(this.flags.cmd)
      if (!Command || !this.flags.flag) return
      let long = this.flags.flag.replace(/-+/, '')
      let flag = Command.flags[long]
      if (flag && flag.completions && flag.completions.options) {
        let flagCache = path.join(this.config.cacheDir, 'completions', long)
        let apps
        try {
          let duration = flag.completions.cacheDuration
          let opts = {cacheFn: flag.completions.options, cacheFnArg: this.heroku}
          apps = await ACCache.fetch(flagCache, duration, opts)
        } catch (err) {
          // fail silently
          // or autocomplete gets weird
        }
        this.out.log((apps || []).join('\n'))
      }
    }
  }
}
