// @flow

if (process.env.HEROKU_TIME_REQUIRE) require('time-require')

import Base, {Config, type ConfigOptions} from 'cli-engine-command'
import Plugins from './plugins'

import Updater from './updater'
import NotFound from './not_found'

const handleEPIPE = err => { if (err.code !== 'EPIPE') throw err }

export default class Main extends Base {
  constructor (options: ConfigOptions) {
    super(new Config(options))
  }

  async run () {
    process.once('exit', () => this.showCursor())
    process.once('SIGINT', () => this.exit(1))
    process.once('uncaughtException', err => this.error(err))
    process.once('unhandledRejection', err => this.error(err))
    process.stdout.on('error', handleEPIPE)
    process.stderr.on('error', handleEPIPE)

    const updater = new Updater(this.config)
    const plugins = new Plugins(this.config)
    await updater.autoupdate()
    await plugins.refreshLinkedPlugins()
    let Command = plugins.findCommand(this.config.argv[1] || this.config.defaultCommand)
    if (!Command) return new NotFound(this.config).run()
    await Command.run(this.config.argv.slice(2), {config: this.config})
    this.exit(0)
  }
}
