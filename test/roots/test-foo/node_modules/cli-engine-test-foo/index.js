exports.topic = {name: 'foo'}

exports.commands = [
  require('./commands/foo/index'),
  require('./commands/foo/usage')
]
