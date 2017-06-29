// @flow

import AutocompleteBase from '.'
import path from 'path'

export default class AutocompletePath extends AutocompleteBase {
  static topic = 'autocomplete'
  static command = 'commandspath'
  static description = 'path to autocomplete commands'
  static hidden = true

  async run () {
    this.errorIfWindows()
    this.out.log(path.join(this.autocompletePath, 'commands'))
  }
}
