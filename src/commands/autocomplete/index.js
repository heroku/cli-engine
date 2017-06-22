// @flow

import Command, {flags} from 'cli-engine-command'
import path from 'path'
import {CustomColors} from 'cli-engine-command/lib/output'

function autocompletePath (datadir: string): string {
  return path.join(datadir, 'client', 'node_modules', 'cli-engine', 'autocomplete')
}

export class AutocompleteBase extends Command {
  get autocompletePath (): string {
    return autocompletePath(this.config.dataDir)
  }
}

export default class Autocomplete extends AutocompleteBase {
  static topic = 'autocomplete'
  static description = 'autocomplete instructions and scripts'
  // hide until beta release
  static hidden = true
  static flags = {
    script: flags.boolean({hidden: true})
  }
  static args = [{name: 'shell', description: 'shell type', required: false}]

  async run () {
    if (this.config.windows) {
      this.out.error('Autocomplete is not currently supported in Windows')
      return
    }

    const shell = this.argv[0] || this.config.shell
    if (!shell) {
      this.out.error('Error: Missing required argument shell')
      return
    }

    switch (shell) {
      case 'bash':
        this.out.log('Symlink the autocomplete function via:')
        this.out.log()
        let fnFile = path.join(this.autocompletePath, 'bash', 'heroku')
        this.out.log(CustomColors.cmd(`$ ln -s ${fnFile} /usr/local/etc/bash_completion.d/heroku`))
        break
      case 'zsh':
        if (this.flags.script) {
          this.out.log(`fpath=(
  ${path.join(this.autocompletePath, 'zsh')}
  $fpath
);
autoload -Uz compinit;
compinit;`)
          return
        }
        this.out.log('Add the autocomplete function to your fpath via:')
        this.out.log()
        this.out.log(CustomColors.cmd(`$ echo $(heroku autocomplete zsh --script) >> ~/.zshrc`))
        break
      default:
        this.out.error(`Currently ${shell} is not a supported shell for autocomplete`)
        return
    }
    this.out.log()
    this.out.log('Lastly, restart your shell')
  }
}
