import { Command, flags } from '@cli-engine/command'
import { cli } from 'cli-ux'
import * as fs from 'fs-extra'
import * as path from 'path'

import { CommandManager, ICommandInfo } from '../command'
import deps from '../deps'

const debug = require('debug')('cli:commands')

export default class Commands extends Command {
  static topic = 'commands'
  static description = 'list all commands'
  static hidden = true
  static flags: flags.Input = { json: flags.boolean() }

  commands: CommandManager

  async run() {
    this.commands = new CommandManager(this.config)
    const commands = await this.commands.commands()
    if (this.flags.json) {
      cli.warn('heroku-cli: This CLI is deprecated. Please reinstall from https://cli.heroku.com')
      await this.addV6Hack()
      await this.outputJSON(commands)
    } else {
      this.outputPlain(commands)
    }
  }

  async outputJSON(commands: ICommandInfo[]) {
    const topics = Object.values(await this.commands.topics()).filter(t => !t.hidden)
    const outputCommands = commands
      .filter(c => !!c)
      .map(c => c!)
      .map(c => ({
        command: c.id
          .split(':')
          .slice(1)
          .join(':'),
        topic: c.id
          .split(':')
          .slice(0, -1)
          .join(':'),
        usage: c.usage,
        description: c.description,
        help: c.help,
        fullHelp: c.help,
        hidden: c.hidden,
      }))
    cli.styledJSON({ topics, commands: outputCommands })
  }

  outputPlain(commands: ICommandInfo[]) {
    for (let id of commands.map(c => c.id)) {
      cli.log(id)
    }
  }

  async addV6Hack() {
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
      if (!await deps.file.exists(cliRB)) return
      let contents = await fs.readFile(cliRB, 'utf8')
      if (contents.startsWith('### begin v6 v.1')) return
      await fs.outputFile(cliRB, hack + contents)
    } catch (err) {
      debug(err)
    }
  }
}
