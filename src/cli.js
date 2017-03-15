// @flow

if (process.env.HEROKU_TIME_REQUIRE) require('time-require')

import {Config, type ConfigOptions} from 'cli-engine-command'
import Output from 'cli-engine-command/lib/output'
import Plugins from './plugins'

import Updater from './updater'
import NotFound from './not_found'

const handleEPIPE = err => { if (err.code !== 'EPIPE') throw err }

export default class Main {
  config: Config
  out: Output

  constructor (options: ConfigOptions) {
    this.config = new Config(options)
    this.out = new Output(this.config)
  }

  async run () {
    process.once('exit', () => this.out.showCursor())
    process.once('SIGINT', () => this.out.exit(1))
    process.once('uncaughtException', err => this.out.error(err))
    process.once('unhandledRejection', err => this.out.error(err))
    process.stdout.on('error', handleEPIPE)
    process.stderr.on('error', handleEPIPE)

    const updater = new Updater(this.out)
    const plugins = new Plugins(this.out)
    await updater.autoupdate()
    await plugins.refreshLinkedPlugins()
    let Command = plugins.findCommand(this.config.argv[1] || this.config.defaultCommand)
    if (!Command) return new NotFound(this.out).run()
    await Command.run(this.config.argv.slice(2), {config: this.config})
    this.out.exit(0)
  }
}
