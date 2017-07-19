// @flow

import {flags} from 'cli-engine-command'
import AutocompleteBase from '.'
import Plugins from '../../plugins'
import ACCache from '../../cache'
import path from 'path'
import {APIClient as Heroku} from 'cli-engine-heroku'

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
    resource: flags.string({description: '', char: 'r'}),
    type: flags.string({description: '', char: 't'}),
    prefix: flags.string({description: '', char: 'p'})
  }

  async run () {
    try {
      this.errorIfWindows()

      if (!this.flags.cmd) throw new Error('Missing required value for --cmd')
      if (!this.flags.resource) throw new Error('Missing required value for --resource')

      const plugins = new Plugins(this.out)
      await plugins.load()
      let Command = await plugins.findCommand(this.flags.cmd)
      if (!Command) throw new Error(`Command ${this.flags.cmd} not found`)

      let cacheKey = 'void'
      let cacheCompletion = {}
      if (this.flags.type === 'arg') {
        // console.log('handle addons completion', this.flags)
        let args = Command ? Command.args : []
        let arg = args.find(a => a.name === this.flags.resource)
        if (!arg) throw new Error(`Arg ${this.flags.resource} not found`)
        // TODO: refactor after reusable args
        cacheCompletion = {
          cacheDuration: 60 * 60 * 24, // 1 day
          options: async (out: any) => {
            const heroku = new Heroku({out: out})
            let apps = await heroku.get('/addons')
            // console.log(apps)
            return apps.map(a => a.name).sort()
            // return ['foo', 'bar', 'baz']
          }
        }
        let prefix = this.flags.prefix ? `${this.flags.prefix}_` : ''
        cacheKey = `${prefix}${arg.name}`
      } else {
        let long = this.flags.flag.replace(/^-+/, '')
        let flags = Command ? Command.flags : {}
        let flag = flags[long]
        if (!flag) throw new Error(`Flag ${long} not found`)
        if (flag.completion && flag.completion.options) {
          cacheKey = long
          cacheCompletion = flag.completion
        }
      }

      if (cacheCompletion.options) {
        let flagCache = path.join(this.completionsPath, cacheKey)
        let duration = cacheCompletion.duration || 60 * 60 * 24 // 1 day
        let opts = {cacheFn: () => cacheCompletion.options(this.out)}
        let options = await ACCache.fetch(flagCache, duration, opts)
        this.out.log((options || []).join('\n'))
      }
    } catch (err) {
      console.log(err)
      // fail silently
      // or autocomplete will use error as options
      this.out.logError(err)
    }
  }
}
