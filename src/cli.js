// @flow

import './fs'
import Command from 'cli-engine-command'
import {buildConfig, type Config, type ConfigOptions} from 'cli-engine-config'
import Output from 'cli-engine-command/lib/output'
import Plugins from './plugins'

import Analytics from './analytics'
import Updater from './updater'
import NotFound from './not_found'

import MigrateV5Plugins from './migrator'

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
  mock: boolean
  argv: string[]
  config: Config
  cmd: Command<*>

  constructor (options: {argv: string[], config?: ConfigOptions, mock?: boolean}) {
    this.mock = !!options.mock
    this.argv = options.argv
    this.config = buildConfig(options.config)
    out = new Output({config: this.config, mock: this.mock})
  }

  async run () {
    const updater = new Updater(out)
    let plugins = new Plugins(out)

    const migrator = new MigrateV5Plugins(plugins, this.config)
    const migrated = await migrator.run()
    if (migrated) {
      plugins = new Plugins(out)
    }

    await updater.autoupdate()
    await plugins.refreshLinkedPlugins()
    if (this.cmdAskingForHelp) {
      this.cmd = await Help.run({argv: this.argv.slice(1), config: this.config, mock: this.mock})
    } else {
      let Command = plugins.findCommand(this.argv[1] || this.config.defaultCommand)
      if (!Command) return new NotFound(out, this.argv).run()
      await out.done()
      let analytics = new Analytics({config: this.config, out, plugins})
      analytics.record(Command)
      this.cmd = await Command.run({argv: this.argv.slice(2), config: this.config, mock: this.mock})
    }
    out.exit(0)
  }

  get cmdAskingForHelp (): boolean {
    if (this.isCmdEdgeCase) return false
    if (this.argv.find(arg => ['--help', '-h'].includes(arg))) {
      return true
    }
    return false
  }

  get isCmdEdgeCase (): boolean {
    let j = this.argv.indexOf('--')
    if (j !== -1) {
      for (var i = 0; i < j; i++) {
        if (['--help', '-h'].includes(this.argv[i])) return false
      }
      return true
    }
    return false
  }
}
