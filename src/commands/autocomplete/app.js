// @flow

import AutocompleteBase from '.'
import path from 'path'

export default class AutocompleteAddOns extends AutocompleteBase {
  static topic = 'autocomplete'
  static command = 'app'
  static description = 'test for add-ons completions'
  static hidden = false
  static flags = {
    // addon: flags.string({description: '', char: 'c'})
  }
  static args = [{name: 'addon', optional: true}]

  async run () {
    this.out.log(this.args)
  }
}
