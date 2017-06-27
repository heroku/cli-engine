// @flow

import Command, {flags} from 'cli-engine-command'
import path from 'path'
import {CustomColors} from 'cli-engine-command/lib/output'
import AutocompleteBase from '.'

export default class InstallScript extends AutocompleteBase {
  static topic = 'autocomplete'
  static command = 'script'
  static description = 'outputs autocomplete config script for shells'
  // hide until beta release
  static hidden = true
  static args = [{name: 'shell', description: 'shell type', required: false}]

  async run () {
    if (this.config.windows) {
      this.out.error('Autocomplete is not currently supported in Windows')
    }

    const shell = this.argv[0] || this.config.shell
    if (!shell) {
      this.out.error('Error: Missing required argument shell')
    }

    switch (shell) {
      case 'zsh':
        this.out.log(`fpath=(
  ${path.join(this.autocompletePath, 'zsh')}
  $fpath
);
autoload -Uz compinit;
compinit;`)
        break
      default:
        this.out.error(`Currently ${shell} is not a supported shell for autocomplete`)
    }
  }
}
