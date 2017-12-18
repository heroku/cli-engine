require('./fs')
import deps from './deps'
import { color } from 'heroku-cli-color'
import { buildConfig, Config, ConfigOptions, ICommand } from 'cli-engine-config'
import { default as cli } from 'cli-ux'
import * as path from 'path'
import { Hooks } from './hooks'

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
  private config: Config
  private Command: ICommand | undefined
  private hooks: Hooks

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
    if (this.config.debug) cli.config.debug = true
  }

  async run() {
    debug('starting run')
    const config = this.config
    let argv = config.argv.slice(1)
    const id = this.config.argv[1]

    if (id !== 'update') {
      const updater = new deps.Updater(this.config)
      debug('checking autoupdater')
      await updater.autoupdate()
    }

    this.hooks = new deps.Hooks(this.config)
    await this.hooks.run('init')

    debug('command_manager')
    const plugins = new deps.Plugins({ config })
    if (this.cmdAskingForHelp) {
      debug('asking for help')
      this.Command = deps.Help
      argv = this.config.argv
    } else {
      this.Command = await plugins.findCommand(id || this.config.defaultCommand || 'help')
    }

    if (!this.Command) {
      const topic = await plugins.findTopic(id)
      if (topic) {
        debug('showing help for %s topic', id)
        this.Command = deps.Help
        argv = this.config.argv
      } else {
        debug('no command found')
        this.Command = deps.NotFound
      }
    }

    const { _version } = this.Command
    if (_version === '0.0.0') {
      debug('legacy cli-engine-command version', _version)
      argv = this.config.argv.slice(2)
    } else if (deps.semver.lt(_version, '10.0.0')) {
      debug(`legacy cli-engine-command version`, _version)
      argv = this.config.argv.slice(0)
    }

    await this.hooks.run('prerun', {
      Command: this.Command!,
      argv,
    })

    debug('running %s', this.Command!.id)
    const cmd = await this.Command!.run({ ...this.config, argv })
    debug('exited normally')

    await this.exitAfterStdoutFlush()
    return cmd
  }

  async exitAfterStdoutFlush() {
    const { timeout } = require('./util')
    cli.done()
    await timeout(this.flush(), 10000)
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
}

export function run({ config }: { config?: ConfigOptions } = {}) {
  if (!config) config = {}
  const cli = new CLI({ config })
  return cli.run()
}
