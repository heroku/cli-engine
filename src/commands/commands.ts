import {cli} from 'cli-ux'
import {Command, flags, InputFlags} from 'cli-engine-command'
import {Plugins} from '../plugins'
import * as fs from 'fs-extra'
import * as path from 'path'

const debug = require('debug')('cli:commands')

export default class Commands extends Command {
  static topic = 'commands'
  static hidden = true
  static flags: InputFlags = {json: flags.boolean()}

  plugins: Plugins

  async run () {
    this.plugins = new Plugins({config: this.config})
    await this.plugins.init()
    if (this.flags.json) {
      cli.warn('heroku-cli: This CLI is deprecated. Please reinstall from https://cli.heroku.com')
      await this.addV6Hack()
      await this.outputJSON()
    } else {
      this.outputPlain()
    }
  }

  async outputJSON () {
    const topics = Object.values(this.plugins.topics).filter(t => !t.hidden)
    const commands = this.plugins.commandIDs
      .map(id => this.plugins.findCommand(id)!)
      .filter(c => !!c)
      .map(c => ({
        command: c.command,
        topic: c.topic,
        usage: c.usage,
        description: c.description,
        help: c.help,
        fullHelp: c.help,
        hidden: c.hidden
      }))
    cli.styledJSON({topics, commands})
  }

  outputPlain () {
    const commands = this.plugins.commandIDs
    for (let id of commands) {
      cli.log(id)
    }
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
      // @ts-ignore
      if (!(await fs.exists(cliRB))) return
      let contents = await fs.readFile(cliRB, 'utf8')
      if (contents.startsWith('### begin v6 v.1')) return
      await fs.outputFile(cliRB, hack + contents)
    } catch (err) {
      debug(err)
    }
  }
}
