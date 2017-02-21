// @flow

/* globals
   $Shape
*/

if (process.env.HEROKU_TIME_REQUIRE) require('time-require')

import ansi from 'ansi-escapes'
import legacy from 'cli-engine-command/lib/legacy'

import config from './config'
import plugins from './plugins'
import errors from './errors'

import NoCommand from './commands/no_command'
import Update from './commands/update'

if (module.parent) config.init(module.parent)
let argv = process.argv.slice(2)
argv.unshift(config.bin)

function onexit (options) {
  if (process.stderr.isTTY) process.stderr.write(ansi.cursorShow)
  if (options.exit) process.exit(1)
}

process.on('exit', onexit)
process.on('SIGINT', onexit.bind(null, {exit: true}))
process.on('uncaughtException', err => {
  errors.logError(err)
  onexit({exit: true})
})

export default async function main (c: $Shape<config>) {
  Object.assign(config, c)
  let command
  try {
    const update = new Update([], config)
    await update.autoupdate()
    let Command
    command = plugins.commands[argv[1] || config.defaultCommand]
    if (command) Command = command.fetch()
    if (!Command) Command = NoCommand
    command = new Command(argv, config)
    await command.init()
    await command.run()
    await command.done()
    process.exit(0)
  } catch (err) {
    errors.logError(err)
    if (command && command.error) command.error(err)
    else console.error(err.stack)
    process.exit(1)
  }
}
