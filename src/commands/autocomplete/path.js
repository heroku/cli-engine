// @flow

import Command from 'cli-engine-command'
import path from 'path'
import AutocompleteUtil from '../../autocomplete'

export default class AutocompletePath extends Command {
  static topic = 'autocomplete'
  static command = 'commandspath'
  static description = 'path to autocomplete commands'
  static hidden = true

  get autocompletePath (): string {
    return AutocompleteUtil.autocompletePath(this.config.dataDir)
  }

  async run () {
    if (this.config.windows) {
      this.out.error('Autocomplete is not currently supported in Windows')
      return
    }

    this.out.log(path.join(this.autocompletePath, 'commands'))
  }
}
