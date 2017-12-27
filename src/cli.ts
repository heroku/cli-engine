require('./fs')
import { Config, ConfigOptions } from '@cli-engine/config'
import { color } from '@heroku-cli/color'
import cli from 'cli-ux'
import * as path from 'path'

import deps from './deps'

export default class CLI {
  constructor(private config: Config) {}

  public async run(argv: string[]): Promise<any> {
    this.debug('starting run: %o', argv)
    this.setupHandlers()
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

  private get debug() {
    return require('debug')('cli')
  }

  private get global(): { testing?: boolean } {
    return global as any
  }

  private setupHandlers() {
    process.env.CLI_ENGINE_VERSION = require('../package.json').version
    if (this.global.testing) return
    process.once('SIGINT', () => {
      if (cli.action.task) cli.action.stop(color.red('ctrl-c'))
      cli.exit(1)
    })
    let handleErr = (err: Error) => {
      cli.error(err)
    }
    process.once('uncaughtException', handleErr)
    process.once('unhandledRejection', handleErr)
    const handleEPIPE = (err: Error) => {
      if ((err as any).code !== 'EPIPE') throw err
    }
    process.stdout.on('error', handleEPIPE)
    process.stderr.on('error', handleEPIPE)
  }

  private async exitAfterStdoutFlush() {
    if (this.global.testing) return
    await deps.util.timeout(this.flush(), 10000)
  }

  private flush(): Promise<any> {
    let p = new Promise(resolve => process.stdout.once('drain', resolve))
    process.stdout.write('')
    return p
  }
}

export function run(argv?: string[], opts?: ConfigOptions): Promise<any>
export function run(opts: ConfigOptions): Promise<any>
export function run(arg1: string[] | ConfigOptions = process.argv, opts: ConfigOptions = {}): Promise<any> {
  let argv: string[]
  if (Array.isArray(arg1)) argv = arg1
  else {
    opts = arg1
    argv = opts.argv || process.argv
  }
  if (!opts.reexecBin) opts.reexecBin = module.parent!.filename
  if (!opts.root) opts.root = path.join(module.parent!.filename, '..', '..')
  if (!opts.pjson) {
    const f = path.join(opts.root, 'package.json')
    opts.pjson = require(f)
    deps.validate.cliPjson(opts.pjson, f)
  }
  const config = new Config(opts)
  if (config.debug) cli.config.debug = true
  cli.config.errlog = config.errlog
  return new CLI(config).run(argv)
}
