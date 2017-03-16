// @flow

if (process.env.HEROKU_TIME_REQUIRE) require('time-require')

import {Config, type ConfigOptions} from 'cli-engine-command'
import Output from 'cli-engine-command/lib/output'
import Plugins from './plugins'

import Updater from './updater'
import NotFound from './not_found'

const handleEPIPE = err => { if (err.code !== 'EPIPE') throw err }

let out: Output
process.once('exit', () => out ? out.showCursor() : null)
process.once('SIGINT', () => out ? out.exit(1) : process.exit(1))
let handleErr = err => {
  if (!out) throw err
  out.error(err)
}
process.once('uncaughtException', handleErr)
process.once('unhandledRejection', handleErr)
process.stdout.on('error', handleEPIPE)
process.stderr.on('error', handleEPIPE)

export default class Main {
  config: Config

  constructor (options: ConfigOptions) {
    this.config = new Config(options)
    out = new Output(this.config)
  }

  async run () {
    const updater = new Updater(out)
    const plugins = new Plugins(out)
    await updater.autoupdate()
    await plugins.refreshLinkedPlugins()
    let Command = plugins.findCommand(this.config.argv[1] || this.config.defaultCommand)
    if (!Command) return new NotFound(out).run()
    await out.done()
    await Command.run(this.config.argv.slice(2), this.config)
    out.exit(0)
  }
}
