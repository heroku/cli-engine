// @flow

import AutocompleteBase from '.'
import path from 'path'

export default class AutocompletePath extends AutocompleteBase {
  static topic = 'autocomplete'
  static command = 'commandspath'
  static description = 'path to autocomplete commands'
  static hidden = true

  async run () {
    if (this.config.windows) {
      this.out.error('Autocomplete is not currently supported in Windows')
    } else this.out.log(path.join(this.autocompletePath, 'commands'))
  }
}
