// @flow

import Command, {Config, type ConfigOptions} from 'cli-engine-command'
import Output from 'cli-engine-command/lib/output'
import Plugins from './plugins'

import Updater from './updater'
import NotFound from './not_found'

import Help from './commands/help'

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
  cmd: Command<*>

  constructor (options: ConfigOptions) {
    this.config = new Config(options)
    out = new Output(this.config)
  }

  async run () {
    const updater = new Updater(out)
    const plugins = new Plugins(out)
    await updater.autoupdate()
    await plugins.refreshLinkedPlugins()
    if (this.cmdAskingForHelp) {
      this.cmd = await Help.run(this.config.argv.slice(1), this.config)
    } else {
      let Command = plugins.findCommand(this.config.argv[1] || this.config.defaultCommand)
      if (!Command) return new NotFound(out).run()
      await out.done()
      this.cmd = await Command.run(this.config.argv.slice(2), this.config)
    }
    out.exit(0)
  }

  get cmdAskingForHelp (): boolean {
    if (this.isCmdEdgeCase) return false
    if (this.config.argv.find(arg => ['--help', '-h'].includes(arg))) {
      return true
    }
    return false
  }

  get isCmdEdgeCase (): boolean {
    let j = this.config.argv.indexOf('--')
    if (j !== -1) {
      for (var i = 0; i < j; i++) {
        if (['--help', '-h'].includes(this.config.argv[i])) return false
      }
      return true
    }
    return false
  }
}
