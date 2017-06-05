// @flow

import Command, {flags} from 'cli-engine-command'
import path from 'path'
import {CustomColors} from 'cli-engine-command/lib/output'

export default class Autocomplete extends Command {
  static topic = 'autocomplete'
  static description = 'autocomplete installation instructions'
  static hidden = true
  static args = [
    {name: 'shell', description: 'shell to use', required: false}
  ]
  static flags = {
    location: flags.boolean({hidden: true})
  }

  async run () {
    if (this.config.windows) {
      this.out.warn('Autocomplete is not currently supported in Windows')
      return
    }

    const autocompletePath = path.join(this.config.dataDir, 'client', 'autocomplete')
    if (this.flags.location) {
      this.out.log(autocompletePath)
      return
    }

    const shell = this.argv[0]
    if (!shell) {
      this.out.error('Error: Missing required argument shell')
      return
    }

    switch (shell) {
      case 'bash':
        this.out.log('Symlink the autocomplete function via:')
        this.out.log()
        this.out.log(CustomColors.cmd(`$ ln -s ${autocompletePath}/commands /usr/local/etc/bash_completion.d/heroku`))
        break
      case 'zsh':
        this.out.log('Add the autocomplete function to your fpath via:')
        this.out.log()
        this.out.log(CustomColors.cmd(`$ echo 'fpath=(${autocompletePath}/zsh $fpath)' >> ~/.zshrc`))
        break
      default:
        this.out.log('Currently not a supported shell for autocomplete')
    }
    this.out.log()
    this.out.log('Lastly, restart your shell')
  }
}
