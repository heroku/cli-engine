// @flow

import Command, {flags} from 'cli-engine-command'
import path from 'path'
import {CustomColors} from 'cli-engine-command/lib/output'

export default class Autocomplete extends Command {
  static topic = 'autocomplete'
  static description = 'autocomplete installation instructions'
  static hidden = true
  static flags = {
    commands: flags.boolean({hidden: true}),
    script: flags.boolean({hidden: true}),
    shell: flags.string({description: 'shell to use', char: 's'})
  }

  async run () {
    if (this.config.windows) {
      this.out.warn('Autocomplete is not currently supported in Windows')
      return
    }

    const clientPath = path.join(this.config.dataDir, 'client')
    if (this.flags.commands) {
      this.out.log(path.join(clientPath, 'autocomplete', 'commands'))
      return
    }
    let shell = this.flags.shell
    if (!shell) shell = this.config.shell
    if (!shell) {
      this.out.error('Error: Missing required argument shell')
      return
    }

    switch (shell) {
      case 'bash':
        this.out.log('Symlink the autocomplete function via:')
        this.out.log()
        let fnFile = path.join(clientPath, 'node_modules', 'cli-engine', 'autocomplete', 'bash', 'heroku')
        this.out.log(CustomColors.cmd(`$ ln -s ${fnFile} /usr/local/etc/bash_completion.d/heroku`))
        break
      case 'zsh':
        if (this.flags.script) {
          this.out.log(`fpath=(
  ${path.join(clientPath, 'node_modules', 'cli-engine', 'autocomplete', 'zsh')}
  $fpath
);
autoload -Uz compinit;
compinit;`)
          return
        }
        this.out.log('Add the autocomplete function to your fpath via:')
        this.out.log()
        this.out.log(CustomColors.cmd(`$ echo $(heroku autocomplete --shell zsh --script) >> ~/.zshrc`))
        break
      default:
        this.out.log(`Currently ${shell} not a supported shell for autocomplete`)
        return
    }
    this.out.log()
    this.out.log('Lastly, restart your shell')
  }
}
