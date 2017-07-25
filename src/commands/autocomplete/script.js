// @flow

import path from 'path'
import AutocompleteBase from '.'
import AutocompleteScripter from '../../autocomplete'

export default class AutocompleteScript extends AutocompleteBase {
  static topic = 'autocomplete'
  static command = 'script'
  static description = 'outputs autocomplete config script for shells'
  // hide until beta release
  static hidden = true
  static args = [{name: 'shell', description: 'shell type', required: false}]

  async run () {
    this.errorIfWindows()
    const ac = new AutocompleteScripter(this)
    await ac.generateCommandsCache()
    await ac.generateCommandFuncsCache()

    const shell = this.argv[0] || this.config.shell
    if (!shell) {
      this.out.error('Error: Missing required argument shell')
    }


    switch (shell) {
      case 'zsh':
        this.out.log(`HEROKU_AC_SETUP_PATH=${path.join(this.completionsPath, 'zsh_setup')} && test -f $HEROKU_AC_SETUP_PATH && source $HEROKU_AC_SETUP_PATH;`)
        break
      default:
        this.out.error(`No autocomplete script for ${shell}. Run $ heroku autocomplete for install instructions.`)
    }
  }
}
