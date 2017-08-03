// @flow

import './fs'
import Command from 'cli-engine-command'
import {buildConfig, type Config, type ConfigOptions} from 'cli-engine-config'
import Output from 'cli-engine-command/lib/output'
import Plugins from './plugins'
import {timeout} from './util'

import Analytics from './analytics'
import Updater from './updater'
import NotFound from './not_found'
import Lock from './lock'

import MigrateV5Plugins from './plugins/migrator'

import Help from './commands/help'

const debug = require('debug')('cli-engine:cli')
const handleEPIPE = err => { if (err.code !== 'EPIPE') throw err }

let out: Output
if (!global.testing) {
  process.once('SIGINT', () => {
    if (out) {
      if (out.action.task) out.action.stop(out.color.red('ctrl-c'))
      out.exit(1)
    } else {
      process.exit(1)
    }
  })
  let handleErr = err => {
    if (!out) throw err
    out.error(err)
  }
  process.once('uncaughtException', handleErr)
  process.once('unhandledRejection', handleErr)
  process.stdout.on('error', handleEPIPE)
  process.stderr.on('error', handleEPIPE)
}

export default class Main {
  mock: boolean
  argv: string[]
  config: Config
  cmd: Command<*>
  lock: Lock

  constructor (options: {argv: string[], config?: ConfigOptions, mock?: boolean}) {
    this.mock = !!options.mock
    this.argv = options.argv
    this.config = buildConfig(options.config)
    out = new Output({config: this.config, mock: this.mock})
    if (process.env.CLI_ENGINE_SHOW_CONFIG) {
      out.inspect(this.config)
    }
    this.lock = new Lock(out)
  }

  async run () {
    debug('starting run')

    const updater = new Updater(out)
    debug('autoupdating')
    await updater.autoupdate()

    try {
      const migrator = new MigrateV5Plugins(out)
      await migrator.run()
    } catch (err) {
      out.warn('Error migrating v5 plugins')
      out.warn(err)
    }

    if (this.cmdAskingForHelp) {
      debug('running help')
      this.cmd = await Help.run({argv: this.argv.slice(1), config: this.config, mock: this.mock})
    } else {
      debug('loading plugins')
      let plugins = new Plugins(out)
      await plugins.load()

      debug('finding command')
      const id = this.argv[1]
      let Command = await plugins.findCommand(id || this.config.defaultCommand)
      if (!Command) return new NotFound(out, this.argv).run()
      debug('out.done()')
      await out.done()
      debug('recording analytics')
      let analytics = new Analytics({config: this.config, out, plugins})
      await analytics.record(id)
      debug('running cmd')
      await this.lock.unread()
      this.cmd = await Command.run({argv: this.argv.slice(2), config: this.config, mock: this.mock})
    }
    debug('flushing stdout')
    await timeout(this.flush(), 10000)
    debug('exiting')
    out.exit(0)
  }

  flush (): Promise<> {
    if (global.testing) return Promise.resolve()
    let p = new Promise(resolve => process.stdout.once('drain', resolve))
    process.stdout.write('')
    return p
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
