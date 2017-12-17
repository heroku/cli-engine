import { color } from 'heroku-cli-color'
import { cli } from 'cli-ux'
import { Command, flags, InputFlags } from 'cli-engine-command'
import { compare } from '../../util'
import { Plugins } from '../../plugins'

let examplePlugins = {
  'heroku-ci': { version: '1.8.0' },
  'heroku-cli-status': { version: '3.0.10', type: 'link' },
  'heroku-fork': { version: '4.1.22' },
}
let bin = 'heroku'
const g = global as any
if (g.config) {
  bin = g.config.bin
  let pjson = g.config.pjson['cli-engine']
  if (pjson['help'] && pjson['help']['plugins']) {
    examplePlugins = pjson['help']['plugins']
  }
}
const examplePluginsHelp = Object.entries(examplePlugins).map(([name, p]: [string, any]) => `    ${name} ${p.version}`)

export default class extends Command {
  static topic = 'plugins'
  static flags: InputFlags = { core: flags.boolean({ description: 'show core plugins' }) }
  static description = 'list installed plugins'
  static help = `Example:
    $ ${bin} plugins
${examplePluginsHelp.join('\n')}
`

  async run() {
    let plugins = await this.fetchPlugins()
    plugins.sort(compare('name'))
    if (!this.flags.core) plugins = plugins.filter(p => p.type !== 'core')
    if (!plugins.length) cli.warn('no plugins installed')
    for (let plugin of plugins) {
      let output = `${plugin.name} ${color.dim(plugin.version)}`
      if (plugin.type !== 'user') output += color.dim(` (${plugin.type})`)
      else if (plugin.tag !== 'latest') output += color.dim(` (${String(plugin.tag)})`)
      cli.log(output)
    }
  }

  private fetchPlugins() {
    const plugins = new Plugins({ config: this.config })
    return plugins.plugins()
  }
}
