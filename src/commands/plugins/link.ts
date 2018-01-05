import { flags } from '@cli-engine/command'
import { cli } from 'cli-ux'
import * as path from 'path'

import { Hooks } from '../../hooks'

import Command from '../base'

let bin = 'heroku'
const g = global as any
if (g.config) {
  bin = g.config.bin
}

export default class PluginsLink extends Command {
  static topic = 'plugins'
  static command = 'link'
  static flags: flags.Input = {
    force: flags.boolean({ char: 'f' }),
  }
  static args = [{ name: 'path', optional: true, description: 'local file path to plugin root' }]
  static description = 'links a local plugin to the CLI for development'
  static help = `Example:
    $ ${bin} plugins:link .
    Installing dependencies for /Users/dickeyxxx/src/github.com/heroku/heroku-status... done
    Running prepare script for /Users/dickeyxxx/src/github.com/heroku/heroku-status... done`

  async run() {
    let p = path.resolve(this.argv[0] || process.cwd())
    cli.action.start(`Linking ${p}`)
    await this.config.plugins.install({ type: 'link', root: p, force: this.flags.force })
    const hooks = new Hooks(this.config)
    await hooks.run('update')
  }
}
