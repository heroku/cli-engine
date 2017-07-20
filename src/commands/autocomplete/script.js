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
    await ac.generateCommandFuncs()

    const shell = this.argv[0] || this.config.shell
    if (!shell) {
      this.out.error('Error: Missing required argument shell')
    }

    switch (shell) {
      case 'zsh':
        this.out.log(`HEROKU_COMMANDS_PATH=${this.completionsPath}/commands;
source \${HEROKU_COMMANDS_PATH}_functions;
fpath=(
  ${path.join(this.functionsPath, 'zsh')}
  $fpath
);
autoload -Uz compinit;
compinit;`)
        break
      default:
        this.out.error(`No autocomplete script for ${shell}. Run $ heroku autocomplete for install instructions.`)
    }
  }
}
