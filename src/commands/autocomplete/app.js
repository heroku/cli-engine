// @flow

import AutocompleteBase from '.'
import path from 'path'
import type Output from 'cli-engine-command/lib/output'
import {APIClient as Heroku} from 'cli-engine-heroku'
import {flags} from 'cli-engine-command'

const appArgCompletion = {
  cacheDuration: 60 * 60 * 24, // 1 day
  options: async (out: Output) => {
    const heroku = new Heroku({out: out})
    let apps = await heroku.get('/apps')
    return apps.map(a => a.name).sort()
  }
}

const addonCompletion = {
  cacheDuration: 60 * 60 * 24, // 1 day
  options: async (out: Output) => {
    const heroku = new Heroku({out: out})
    let apps = await heroku.get('/addons')
    return apps.map(a => a.name).sort()
  }
}

export default class AutocompleteAddOns extends AutocompleteBase {
  static topic = 'addons'
  static command = 'app'
  static description = 'test for add-ons completions'
  static hidden = false
  static flags = {
    addon: flags.string({description: 'addon to use', char: 'a', completion: addonCompletion})
  }
  static args = [
    {name: 'app', optional: true, completion: appArgCompletion},
    {name: 'addon', optional: true, completion: addonCompletion}
  ]

  async run () {
    this.out.log(this.args)
  }
}
