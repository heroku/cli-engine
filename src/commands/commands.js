// @flow

import Command, {flags} from 'cli-engine-command'
import Plugins from '../plugins'
import fs from 'fs-extra'
import path from 'path'

export default class Commands extends Command {
  static topic = 'commands'
  static hidden = true
  static flags = {json: flags.boolean()}

  async run () {
    this.out.warn('heroku-cli: This CLI is deprecated. Please reinstall from https://cli.heroku.com')
    await this.addV6Hack()
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

  async addV6Hack () {
    try {
      const hack = `### begin v6 v.1
begin
  pluginsDir = File.join(Dir.home, ".heroku", "plugins")
  bin = File.join(Dir.home, ".local", "share", "heroku", "client", "bin", "heroku")
  if File.exists?(bin) && (!Dir.exists?(pluginsDir) || Dir.entries(pluginsDir).count <= 2)
    puts "Running: #{bin}" if ENV['HEROKU_DEBUG'] || ENV['DEBUG']
    system bin, *ARGV
    status = $?.exitstatus
    exit status
  end
rescue => e
  puts e
end
### end v6 v.1

`
      if (this.config.windows) return
      let cliRB = path.join(this.config.home, '.heroku', 'client', 'lib', 'heroku', 'cli.rb')
      if (!(await fs.exists(cliRB))) return
      let contents = await fs.readFile(cliRB, 'utf8')
      if (contents.startsWith('### begin v6 v.1')) return
      await fs.outputFile(cliRB, hack + contents)
    } catch (err) {
      this.out.debug(err)
    }
  }
}
