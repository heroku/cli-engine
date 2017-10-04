require('./fs')
import { buildConfig, Config, ConfigOptions, ICommand } from 'cli-engine-config'
import cli from 'cli-ux'
import * as path from 'path'
import { Hooks, PreRunOptions } from './hooks'
import * as chalk from 'chalk'
import { deps } from './deps'

const debug = require('debug')('cli')
const handleEPIPE = (err: any) => {
  if (err.code !== 'EPIPE') throw err
}

const testing = (global as any)['columns']
if (!testing) {
  process.once('SIGINT', () => {
    if (cli) {
      if (cli.action.running) cli.action.stop(chalk.red('ctrl-c'))
      cli.exit(1)
    } else {
      process.exit(1)
    }
  })
  let handleErr = (err: Error) => {
    if (!cli) throw err
    cli.error(err)
  }
  process.once('uncaughtException', handleErr)
  process.once('unhandledRejection', handleErr)
  process.stdout.on('error', handleEPIPE)
  process.stderr.on('error', handleEPIPE)
}

process.env.CLI_ENGINE_VERSION = require('../package.json').version

export default class CLI {
  config: Config
  cmd?: ICommand
  hooks: Hooks

  constructor(config: ConfigOptions = {}) {
    if (!config) config = {}
    if (!config.initPath) {
      config.initPath = module.parent!.filename
    }
    if (!config.root) {
      const findUp = require('find-up')
      config.root = path.dirname(
        findUp.sync('package.json', {
          cwd: module.parent!.filename,
        }),
      )
    }
    this.config = buildConfig(config)
    ;(<any>global).config = this.config
    cli.config.debug = this.config.debug
    cli.config.errlog = this.config.errlog
  }

  async run() {
    debug('starting run')
    const config = this.config

    const updater = new deps.Updater(config)
    debug('checking autoupdater')
    await updater.autoupdate()

    this.hooks = new deps.Hooks({ config: this.config })
    await this.hooks.run('init')

    debug('command_manager')
    const id = this.config.argv[2]
    const commandManager = new deps.CommandManager(config, cli)
    if (this.cmdAskingForHelp) {
      debug('asking for help')
      this.cmd = new deps.Help(config)
    } else {
      this.cmd = await commandManager.findCommand(id || this.config.defaultCommand || 'help')
    }

    if (!this.cmd) {
      let topic = await commandManager.findTopic(id)
      if (topic) {
        debug('showing help for %s topic', id)
        this.cmd = new deps.Help(config)
      } else {
        debug('no command found')
        this.cmd = new deps.NotFound(config)
      }
    }

    let opts: PreRunOptions = {
      command: this.cmd,
      argv: this.config.argv.slice(2),
    }
    await this.hooks.run('prerun', opts)

    let lock = new deps.Lock(config)
    await lock.unread()
    debug('running %s', this.cmd.__config.id)
    await this.cmd._run(config.argv.slice(3))

    await this.exitAfterStdoutFlush()
  }

  async exitAfterStdoutFlush() {
    debug('flushing stdout')
    const { timeout } = deps.util
    cli.done()
    await timeout(this.flush(), 10000)
    debug('exiting')
  }

  flush(): Promise<any> {
    if (testing) return Promise.resolve()
    let p = new Promise(resolve => process.stdout.once('drain', resolve))
    process.stdout.write('')
    return p
  }

  get cmdAskingForHelp(): boolean {
    for (let arg of this.config.argv) {
      if (['--help', '-h'].includes(arg)) return true
      if (arg === '--') return false
    }
    return false
  }
}

export function run(config: ConfigOptions = {}) {
  const cli = new CLI(config)
  return cli.run()
}
