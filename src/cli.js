// @flow

import type {Command} from 'cli-engine-command'
import {buildConfig, type Config, type ConfigOptions} from 'cli-engine-config'
import type Output from 'cli-engine-command/lib/output'
import path from 'path'
import type {Hooks, PreRunOptions} from './hooks'

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
  cmd: Command<*>
  hooks: Hooks

  constructor ({config}: {|config?: ConfigOptions|} = {}) {
    if (!config) config = {}
    if (!config.initPath) {
      config.initPath = module.parent.filename
    }
    if (!config.root) {
      const findUp = require('find-up')
      config.root = path.dirname(findUp.sync('package.json', {
        cwd: module.parent.filename
      }))
    }
    this.config = buildConfig(config)
  }

  async run () {
    debug('starting run')

    require('./fs')
    const {default: Output} = require('cli-engine-command/lib/output')
    out = new Output(this.config)
    const {Updater} = require('./updater')
    const updater = new Updater(out)
    debug('checking autoupdater')
    await updater.autoupdate()

    const {Hooks} = require('./hooks')
    this.hooks = new Hooks({config: this.config})
    await this.hooks.run('init')

    if (this.cmdAskingForHelp) {
      const {default: Help} = this.config.userPlugins ? require('./commands/help') : require('./commands/newhelp')
      debug('running help command')
      this.cmd = await Help.run(this.config)
    } else {
      debug('dispatcher')
      const id = this.config.argv[1]
      const {Dispatcher} = require('./dispatcher')
      const dispatcher = new Dispatcher(this.config)
      let {Command, plugin} = await dispatcher.findCommand(id || this.config.defaultCommand || 'help')

      if (Command) {
        let {default: Lock} = require('./lock')
        let lock = new Lock(out)
        await lock.unread()
        let opts: PreRunOptions = {
          Command,
          plugin,
          argv: this.config.argv.slice(2)
        }
        await this.hooks.run('prerun', opts)
        debug('running cmd')
        if (!Command._version) {
          // old style command
          // flow$ignore
          this.cmd = await Command.run({
            argv: this.config.argv.slice(2),
            config: this.config,
            mock: this.config.mock
          })
        } else {
          this.cmd = await Command.run(this.config)
        }
      } else {
        let topic = await dispatcher.findTopic(id)
        if (topic) {
          const {default: Help} = this.config.userPlugins ? require('./commands/help') : require('./commands/newhelp')
          await Help.run(this.config)
        } else {
          const {NotFound} = require('./not_found')
          return new NotFound(out, this.config.argv).run()
        }
      }
    }

    debug('flushing stdout')
    const {timeout} = require('./util')
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
