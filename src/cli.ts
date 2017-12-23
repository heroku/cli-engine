require('./fs')
import { buildConfig, ConfigOptions, IConfig } from 'cli-engine-config'
import cli from 'cli-ux'
import { color } from 'heroku-cli-color'
import * as path from 'path'
import deps from './deps'

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
  constructor(private config: IConfig) {}

  async run(argv: string[]): Promise<any> {
    debug('starting run: %o', argv)
    const id = argv[2]

    if (id !== 'update') {
      const updater = new deps.Updater(this.config)
      await updater.autoupdate()
    }

    const commands = new deps.CommandManager(this.config)
    const result = await commands.run(argv)
    await this.exitAfterStdoutFlush()
    return result
  }

  private async exitAfterStdoutFlush() {
    if (g.testing) return
    const { timeout } = require('./util')
    await timeout(this.flush(), 10000)
  }

  private flush(): Promise<any> {
    let p = new Promise(resolve => process.stdout.once('drain', resolve))
    process.stdout.write('')
    return p
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
