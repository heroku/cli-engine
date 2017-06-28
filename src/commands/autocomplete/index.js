// @flow

import Command from 'cli-engine-command'
import path from 'path'
import {CustomColors} from 'cli-engine-command/lib/output'

export class AutocompleteBase extends Command {
  get autocompletePath (): string {
    return path.join(this.config.dataDir, 'client', 'node_modules', 'cli-engine', 'autocomplete')
  }

  errorIfWindows () {
    if (this.config.windows) {
      this.out.error('Autocomplete is not currently supported in Windows')
    }
  }
}

export default class Autocomplete extends AutocompleteBase {
  static topic = 'autocomplete'
  static description = 'display autocomplete instructions'
  // hide until beta release
  static hidden = true
  static args = [{name: 'shell', description: 'shell type', required: false}]

  async run () {
    this.errorIfWindows()

    const shell = this.argv[0] || this.config.shell
    if (!shell) {
      this.out.error('Error: Missing required argument shell')
    }

    switch (shell) {
      case 'bash':
        this.out.log('Bash autocomplete coming soon')
        // this.out.log('Symlink the autocomplete function via:')
        // this.out.log()
        // let fnFile = path.join(this.autocompletePath, 'bash', 'heroku')
        // this.out.log(CustomColors.cmd(`$ ln -s ${fnFile} /usr/local/etc/bash_completion.d/heroku`))
        break
      case 'zsh':
        this.out.log('Add the autocomplete function to your fpath via:')
        this.out.log()
        this.out.log(CustomColors.cmd(`$ echo $(heroku autocomplete:script zsh) >> ~/.zshrc`))
        break
      default:
        this.out.error(`Currently ${shell} is not a supported shell for autocomplete`)
    }
    this.out.log()
    this.out.log('Lastly, restart your shell')
  }
}
