const {Command} = require('heroku-cli-command')
const config = require('../lib/config')

class Version extends Command {
  async run () {
    if (process.env.HEROKU_DEV) this.log(`HEROKU_DEV=${process.env.HEROKU_DEV}`)
    let channel = config.channel === 'stable' ? '' : ` ${config.channel}`
    this.log(`${config.name}/${config.version}${channel} (${process.platform}-${process.arch}) node-${process.version}`)
  }
}

Version.topic = 'version'
Version.description = 'show CLI version'
Version.aliases = ['-v', 'v', '--version']

module.exports = Version
