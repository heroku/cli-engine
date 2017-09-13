import {Command, flags} from 'cli-engine-command'
import {deps} from '../deps'
import * as fs from 'fs-extra'
import * as path from 'path'
import _ from 'ts-lodash'

const debug = require('debug')('cli:commands')

export default class Commands extends Command {
  hidden = true
  parse = {
    flags: {json: flags.boolean()}
  }

  async run () {
    this.cli.warn('heroku-cli: This CLI is deprecated. Please reinstall from https://cli.heroku.com')
    await this.addV6Hack()
    const commandManager = new deps.CommandManager(this.config)
    let topics = (await commandManager.listTopics()).filter(t => !t.hidden)
    let commandIDs = await commandManager.listCommandIDs()
    let commandInstances = await Promise.all(commandIDs.map(c => commandManager.findCommand(c)))
    let commands = _.compact(commandInstances).filter(c => c.__config.id).map(c => ({
      command: c.__config.id!.split(':').slice(1).join(':') || null,
      topic: c.__config.id!.split(':', 1).join(),
      usage: c.options.usage,
      description: c.options.description,
      help: c.options.help,
      fullHelp: c.options.help,
      hidden: c.options.hidden
    }))
    this.cli.styledJSON({topics, commands})
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
      if (!fs.existsSync(cliRB)) return
      let contents = await fs.readFile(cliRB, 'utf8')
      if (contents.startsWith('### begin v6 v.1')) return
      await fs.outputFile(cliRB, hack + contents)
    } catch (err) {
      debug(err)
    }
  }
}
