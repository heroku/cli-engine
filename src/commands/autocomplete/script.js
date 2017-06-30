// @flow

import path from 'path'
import AutocompleteBase from '.'
import Output from 'cli-engine-command/lib/output'
import {type Config} from 'cli-engine-config'
import fs from 'fs-extra'
import Plugins from '../../plugins'

export default class AutocompleteScript extends AutocompleteBase {
  static topic = 'autocomplete'
  static command = 'script'
  static description = 'outputs autocomplete config script for shells'
  // hide until beta release
  static hidden = true
  static args = [{name: 'shell', description: 'shell type', required: false}]

  async run () {
    this.errorIfWindows()
    await AutocompleteScript.generateAutocompleteCommands(this)

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
      const cmds = plugins.map(p => p.commands.filter(c => !c.hidden || !!c.id).map(c => {
        let publicFlags = Object.keys(c.flags).filter(flag => !c.flags[flag].hidden).map(flag => `--${flag}`).join(' ')
        if (c.args && c.args.find(a => a.name === 'app')) publicFlags.concat(' --app')
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
