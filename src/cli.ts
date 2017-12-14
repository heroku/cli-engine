require('./fs')
import { Command } from 'cli-engine-command'
import { color } from 'cli-engine-command/lib/color'
import { buildConfig, Config, ConfigOptions, ICommand } from 'cli-engine-config'
import { default as cli } from 'cli-ux'
import * as path from 'path'
import { Hooks } from './hooks'
import { Updater } from './updater'
import { Lock } from './lock'
import { CommandManager } from './command_managers'

const debug = require('debug')('cli')
const handleEPIPE = (err: Error) => {
  if ((<any>err).code !== 'EPIPE') throw err
}

const g = global as any
if (!g.testing) {
  process.once('SIGINT', () => {
    if (cli.action.task) cli.action.stop(color.red('ctrl-c'))
    cli.exit(1)
  })
  let handleErr = (err: Error) => {
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
  Command: ICommand | undefined
  cmd: Command
  hooks: Hooks

  constructor({ config }: { config?: ConfigOptions } = {}) {
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
    ;(<any>global)['cli-ux'] = {
      debug: this.config.debug,
      mock: this.config.mock,
    }
  }

  async run() {
    debug('starting run')

    const updater = new Updater(this.config)
    debug('checking autoupdater')
    await updater.autoupdate()

    this.hooks = new Hooks(this.config)
    await this.hooks.run('init')

    debug('command_manager')
    const id = this.config.argv[2]
    const commandManager = new CommandManager(this.config)
    if (this.cmdAskingForHelp) {
      debug('asking for help')
      // this.cmd = new Help(config)
    } else {
      this.Command = await commandManager.findCommand(id || this.config.defaultCommand || 'help')
    }

    if (!this.Command) {
      let topic = await commandManager.findTopic(id)
      if (topic) {
        debug('showing help for %s topic', id)
        // this.cmd = new Help(config)
      } else {
        debug('no command found')
        // this.cmd = new NotFound(config)
      }
    }

    // let opts: PreRunOptions = {
    //   command: this.cmd,
    //   argv: this.config.argv.slice(2),
    // }
    // await this.hooks.run('prerun', opts)

    let lock = new Lock(this.config)
    await lock.unread()
    debug('running %s', this.Command!.id)
    this.cmd = await this.Command!.run({ ...this.config, argv: this.config.argv.slice(2) })

    await this.exitAfterStdoutFlush()
  }

  async exitAfterStdoutFlush() {
    debug('flushing stdout')
    const { timeout } = require('./util')
    cli.done()
    await timeout(this.flush(), 10000)
    debug('exiting')
  }

  flush(): Promise<any> {
    if (g.testing) return Promise.resolve()
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

  get Help() {
    const { default: Help } = this.config.userPlugins ? require('./commands/help') : require('./commands/newhelp')
    return Help
  }
}

export function run({ config }: { config?: ConfigOptions } = {}) {
  if (!config) config = {}
  const cli = new CLI({ config })
  return cli.run()
}
