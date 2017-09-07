// @flow

import {buildConfig, type Config, type ConfigOptions, type RunReturn, type ICommand} from 'cli-engine-config'
import type Output from 'cli-engine-command/lib/output'
import path from 'path'
import type {Hooks, PreRunOptions} from './hooks'
import deps from './deps'

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
  config: Config
  cmd: RunReturn
  hooks: Hooks

  constructor ({config}: {|config?: ConfigOptions|} = {}) {
    if (!config) config = {}
    if (!config.initPath) {
      config.initPath = module.parent.filename
    }
    if (!config.root) {
      config.root = path.dirname(deps.findUp.sync('package.json', {
        cwd: module.parent.filename
      }))
    }
    this.config = buildConfig(config)
  }

  async run () {
    debug('starting run')

    require('./fs')
    out = new deps.Output(this.config)
    const updater = new deps.Updater(out)
    debug('checking autoupdater')
    await updater.autoupdate()

    this.hooks = new deps.Hooks({config: this.config})
    await this.hooks.run('init')

    debug('command_manager')
    const id = this.config.argv[1]
    const {CommandManager} = require('./command_managers')
    const commandManager = new CommandManager({config: this.config, out})
    let Command
    if (this.cmdAskingForHelp) {
      debug('asking for help')
      Command = deps.Help
    } else {
      Command = await commandManager.findCommand(id || this.config.defaultCommand || 'help')
    }

    if (!Command) {
      let topic = await commandManager.findTopic(id)
      if (topic) {
        debug('showing help for %s topic', id)
        Command = deps.Help
      } else {
        debug('no command found')
        Command = deps.NotFound
      }
    }

    let opts: PreRunOptions = {
      Command,
      plugin: Command.plugin,
      argv: this.config.argv.slice(2)
    }
    await this.hooks.run('prerun', opts)

    let lock = new deps.Lock(out)
    await lock.unread()
    debug('running cmd')
    this.cmd = await Command.run(this.commandRunArgs(Command))

    await this.exitAfterStdoutFlush()
  }

  commandRunArgs (Command: ICommand): ConfigOptions {
    if (Command._version) return this.config
    else {
      debug('old style command received')
      return ({
        argv: this.config.argv.slice(2),
        config: this.config,
        mock: this.config.mock
      }: any)
    }
  }

  async exitAfterStdoutFlush () {
    debug('flushing stdout')
    const {timeout} = deps.util
    await timeout(this.flush(), 10000)
    debug('exiting')
  }

  flush (): Promise<void> {
    if (global.testing) return Promise.resolve()
    let p = new Promise(resolve => process.stdout.once('drain', resolve))
    process.stdout.write('')
    return p
  }

  get cmdAskingForHelp (): boolean {
    for (let arg of this.config.argv) {
      if (['--help', '-h'].includes(arg)) return true
      if (arg === '--') return false
    }
    return false
  }
}

export function run ({config}: {config?: ConfigOptions} = {}) {
  if (!config) config = {}
  const cli = new CLI({config})
  return cli.run()
}
