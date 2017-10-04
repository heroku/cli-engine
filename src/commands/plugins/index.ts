import { IBooleanFlag } from 'cli-flags'
import { Command, flags } from 'cli-engine-command'
import { Plugins } from '../../plugins'
import _ from 'ts-lodash'
import cli from 'cli-ux'

let examplePlugins = {
  'heroku-ci': { version: '1.8.0' },
  'heroku-cli-status': { version: '3.0.10', type: 'link' },
  'heroku-fork': { version: '4.1.22' },
}
let cliBin = 'heroku'
let globalConfig = (<any>global).config
if (globalConfig) {
  cliBin = globalConfig.bin
  let pjson = globalConfig.pjson['cli-engine']
  if (pjson['help'] && pjson['help']['plugins']) {
    examplePlugins = pjson['help']['plugins']
  }
}
const examplePluginsHelp = Object.entries(examplePlugins).map(([name, p]: [string, any]) => `    ${name} ${p.version}`)

export default class extends Command {
  options = {
    flags: { core: flags.boolean({ description: 'show core plugins' }) as IBooleanFlag },
    description: 'list installed plugins',
    help: `Example:
    $ ${cliBin} plugins
${examplePluginsHelp.join('\n')}
`,
  }

  async run() {
    let plugins = await new Plugins({ config: this.config }).listPlugins()
    _.sortBy(plugins, 'name')
    if (!this.flags.core) plugins = plugins.filter(p => p.type !== 'core')
    if (!plugins.length) cli.warn('no plugins installed')
    for (let plugin of plugins) {
      let output = `${plugin.name} ${this.color.dim(plugin.version)}`
      if (plugin.type !== 'user') output += this.color.dim(` (${plugin.type})`)
      else if (plugin.tag !== 'latest') output += this.color.dim(` (${String(plugin.tag)})`)
      cli.log(output)
    }
  }
}
