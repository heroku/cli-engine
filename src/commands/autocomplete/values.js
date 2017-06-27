// @flow

import Command, {flags} from 'cli-engine-command'
import Plugins from '../../plugins'
import ACCache from '../../cache'
import path from 'path'

export default class AutocompleteValues extends Command {
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
      if (this.config.windows) {
        this.out.error('Autocomplete is not currently supported in Windows')
        return
      }

      if (this.flags.cmd) {
        const plugins = new Plugins(this.out)
        await plugins.load()
        let Command = await plugins.findCommand(this.flags.cmd)
        if (!Command || !this.flags.flag) this.out.error(`Command ${this.flags.cmd} not found`)
        let long = this.flags.flag.replace(/-+/, '')
        let flag = Command.flags[long]
        if (!flag) this.out.error(`Flag ${long} not found`)
        if (flag.completions && flag.completions.options) {
          let flagCache = path.join(this.config.cacheDir, 'completions', long)
          let duration = flag.completions.cacheDuration || 60 * 60 * 24 // 1 day
          let opts = {cacheFn: () => flag.completions.options(this.out)}
          let options = await ACCache.fetch(flagCache, duration, opts)
          this.out.log((options || []).join('\n'))
        }
      }
    } catch (err) {
      // fail silently
      // or autocomplete will use error as options
      this.out.logError(err)
    }
  }
}
