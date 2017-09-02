// @flow

import './fs'
import Command from 'cli-engine-command'
import {buildConfig, type Config, type ConfigOptions} from 'cli-engine-config'
import Output from 'cli-engine-command/lib/output'
import Plugins from './plugins'
import {timeout} from './util'
import findUp from 'find-up'
import path from 'path'

import Analytics from './analytics'
import Updater from './updater'
import NotFound from './not_found'
import Lock from './lock'
import Hooks from './hooks'

import MigrateV5Plugins from './plugins/migrator'

import Help from './commands/help'

const debug = require('debug')('cli')
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

process.env.CLI_ENGINE_VERSION = require('../package.json').version

export default class CLI {
  mock: boolean
  argv: string[]
  config: Config
  cmd: Command<*>
  lock: Lock
  hooks: Hooks

  constructor (options: { argv: string[], config?: ConfigOptions, mock?: boolean }) {
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
    debug('checking autoupdater')
    await updater.autoupdate()

    this.hooks = new Hooks({config: this.config})
    await this.hooks.run('init')

    try {
      const migrator = new MigrateV5Plugins(out)
      await migrator.run()
    } catch (err) {
      out.warn('Error migrating v5 plugins')
      out.warn(err)
    }

    if (this.config.commandsDir) {
      debug('using new dispatcher')
      const Dispatcher = require('./dispatcher').default
      const dispatcher = new Dispatcher(this.config)
      await dispatcher.run(...this.argv)
    } else if (this.cmdAskingForHelp) {
      debug('running help')
      this.cmd = await Help.run({argv: this.argv.slice(1), config: this.config, mock: this.mock})
    } else {
      debug('loading plugins')
      let plugins = new Plugins(out)
      await plugins.load()

      debug('finding command')
      const id = this.argv[1]
      let Command = await plugins.findCommand(id || this.config.defaultCommand)
      let Topic = await plugins.findTopic(id)
      if (Command) {
        debug('out.done()')
        await out.done()
        debug('recording analytics')
        let analytics = new Analytics({config: this.config, out, plugins})
        await analytics.record(id)
        await this.lock.unread()
        let argv = this.argv.slice(2)
        await this.hooks.run('prerun', {Command, argv})
        debug('running cmd')
        this.cmd = await Command.run({argv, config: this.config, mock: this.mock})
      } else if (Topic) {
        await Help.run({argv: [Topic.topic], config: this.config, mock: this.mock})
      } else {
        return new NotFound(out, this.argv).run()
      }
    }
    debug('flushing stdout')
    await timeout(this.flush(), 10000)
    debug('exiting')
    out.exit(0)
  }

  flush (): Promise<void> {
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

export function run ({config}: {config?: ConfigOptions} = {}) {
  if (!config) config = {}
  if (!config.root) {
    config.root = path.dirname(findUp.sync('package.json', {
      cwd: module.parent.filename
    }))
  }
  const cli = new CLI({
    argv: process.argv.slice(1),
    config
  })
  return cli.run()
}
