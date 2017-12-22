require('./fs')
import { buildConfig, ConfigOptions, ICommand, IConfig } from 'cli-engine-config'
import cli from 'cli-ux'
import { color } from 'heroku-cli-color'
import * as path from 'path'
import deps from './deps'
import { Hooks } from './hooks'

const debug = require('debug')('cli')
const handleEPIPE = (err: Error) => {
  if ((err as any).code !== 'EPIPE') throw err
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
  private hooks: Hooks

  constructor(private config: IConfig) {}

  async run(argv: string[]) {
    debug('starting run: %o', argv)
    const config = this.config
    const id = argv[2]

    if (id !== 'update') {
      const updater = new deps.Updater(this.config)
      debug('checking autoupdater')
      await updater.autoupdate()
    }

    this.hooks = new deps.Hooks(this.config)
    await this.hooks.run('init')

    debug('command_manager')
    const plugins = new deps.Plugins({ config })
    let Command: ICommand | undefined
    await plugins.init()
    if (this.cmdAskingForHelp(argv)) {
      debug('asking for help')
      Command = deps.Help
      argv = [argv[0], argv[1], 'help', ...argv.slice(2)]
    } else {
      Command = await plugins.findCommand(id || this.config.defaultCommand || 'help')
    }

    if (!Command) {
      const topic = await plugins.findTopic(id)
      if (topic) {
        debug('showing help for %s topic', id)
        Command = deps.Help
      } else {
        debug('no command found')
        Command = deps.NotFound
      }
    }

    let run
    const { _version } = Command
    if (_version === '0.0.0') {
      debug('legacy cli-engine-command version', _version)
      let c: any = Command
      run = () => c.run({ ...this.config, argv: argv.slice(2) })
    } else if (deps.semver.lt(_version, '10.0.0')) {
      debug(`legacy cli-engine-command version`, _version)
      let c: any = Command
      run = () => c.run({ ...this.config, argv: argv.slice(1) })
    } else {
      run = () => Command!.run(argv.slice(3), this.config)
    }

    await this.hooks.run('prerun', { argv, Command: Command! })

    debug('running %s', Command!.id)
    const cmd = await run()
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

  cmdAskingForHelp(argv: string[]): boolean {
    for (let arg of argv) {
      if (['--help', '-h'].includes(arg)) return true
      if (arg === '--') return false
    }
    return false
  }
}

export function run(arg1: string[] | ConfigOptions = process.argv, opts: ConfigOptions = {}) {
  const argv = Array.isArray(arg1) ? arg1 : opts.argv || process.argv
  if (!opts.initPath) opts.initPath = module.parent!.filename
  if (!opts.root) {
    const findUp = require('find-up')
    opts.root = path.dirname(
      findUp.sync('package.json', {
        cwd: opts.initPath,
      }),
    )
  }
  const config = buildConfig(opts)
  if (config.debug) cli.config.debug = true
  cli.config.errlog = config.errlog
  return new CLI(config).run(argv)
}
