// @flow

import Command from 'cli-engine-command'
import path from 'path'
import Output, {CustomColors} from 'cli-engine-command/lib/output'
import {type Config} from 'cli-engine-config'
import fs from 'fs-extra'
import Plugins from '../../plugins'

export class AutocompleteBase extends Command {
  get autocompletePath (): string {
    return path.join(this.config.dataDir, 'client', 'node_modules', 'cli-engine', 'autocomplete')
  }

  errorIfWindows () {
    if (this.config.windows) {
      this.out.error('Autocomplete is not currently supported in Windows')
    }
  }

  static async generateAutocompleteCommands ({config, out}: {config: Config, out: Output}) {
    const flatten = require('lodash.flatten')
    try {
      // TODO: move from cli to client dir if not already present
      // if (!fs.pathExistsSync(path.join(this.config.dataDir, 'client', 'autocomplete', 'bash', 'heroku'))) {
      //   const cli = path.join(this.config.dataDir, 'cli', 'autocomplete')
      //   const client = path.join(this.config.dataDir, 'client', 'autocomplete')
      //   fs.copySync(cli, client)
      // }
      const plugins = await new Plugins(out).list()
      const cmds = plugins.map(p => p.commands.filter(c => !c.hidden).map(c => {
        let publicFlags = Object.keys(c.flags).filter(flag => !c.flags[flag].hidden).map(flag => `--${flag}`).join(' ')
        let flags = publicFlags.length ? ` ${publicFlags}` : ''
        let namespace = p.namespace ? `${p.namespace}:` : ''
        return `${namespace}${c.id}${flags}`
      }))
      const commands = flatten(cmds).join('\n')
      fs.writeFileSync(path.join(config.dataDir, 'client', 'node_modules', 'cli-engine', 'autocomplete', 'commands'), commands)
    } catch (e) {
      out.debug('Error creating autocomplete commands')
      out.debug(e.message)
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
    await this.constructor.generateAutocompleteCommands()

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
