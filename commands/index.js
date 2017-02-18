const klaw = require('klaw-sync')
const config = require('../lib/config')

exports.topics = [
  {name: 'plugins', description: `manage ${config.name} plugins`}
]

exports.commands = klaw(__dirname, {nodir: true}).map(f => require(f.path))
