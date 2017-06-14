// @flow

import Command, {flags} from 'cli-engine-command'
import Plugins from '../plugins'

export default class Commands extends Command {
  static topic = 'commands'
  static hidden = true
  static flags = {json: flags.boolean()}

  async run () {
    this.out.warn('heroku-cli: This CLI is deprecated. Please reinstall from https://cli.heroku.com')
    let plugins = new Plugins(this.out)
    await plugins.load()
    let topics = plugins.topics.filter(t => !t.hidden)
    let commands = plugins.commands.map(c => ({
      command: c.command,
      topic: c.topic,
      usage: c.usage,
      description: c.description,
      help: c.help,
      fullHelp: c.help,
      hidden: c.hidden
    }))
    this.out.styledJSON({topics, commands})
  }
}
