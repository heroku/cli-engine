import { Command, flags, IBooleanFlag } from 'cli-engine-command'
import { Plugins } from '../../plugins'
import * as path from 'path'
import { Hooks } from '../../hooks'
import { cli } from 'cli-ux'

let bin = 'heroku'
const g = global as any
if (g.config) {
  bin = g.config.bin
}

export default class PluginsLink extends Command {
  static topic = 'plugins'
  static command = 'link'
  static flags = {
    force: flags.boolean({ char: 'f' }) as IBooleanFlag,
  }
  static args = [{ name: 'path', optional: true, description: 'local file path to plugin root' }]
  static description = 'links a local plugin to the CLI for development'
  static help = `Example:
    $ ${bin} plugins:link .
    Installing dependencies for /Users/dickeyxxx/src/github.com/heroku/heroku-status... done
    Running prepare script for /Users/dickeyxxx/src/github.com/heroku/heroku-status... done`

  async run() {
    const plugins = new Plugins(this.config)
    let p = path.resolve(this.argv[0] || process.cwd())
    cli.action.start(`Linking ${p}`)
    const { name } = await plugins.link.pjson(p)
    if (!this.flags.force && plugins.pluginType(name)) {
      throw new Error('Plugin is already installed. Run with --force to install anyways.')
    }
    await plugins.link.install(p)
    const hooks = new Hooks(this.config)
    await hooks.run('update')
  }
}
