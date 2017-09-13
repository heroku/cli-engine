import { Command } from 'cli-engine-command'
import { buildConfig, Config, ConfigOptions } from 'cli-engine-config'
import { CLI as CLIUX } from 'cli-ux'
import * as path from 'path'
// import {Hooks, PreRunOptions} from './hooks'
import * as chalk from 'chalk'

const debug = require('debug')('cli')
const handleEPIPE = (err: any) => {
  if (err.code !== 'EPIPE') throw err
}

let cli: CLIUX = new CLIUX()
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
  cmd: Command
  // hooks: Hooks

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
    cli = new CLIUX({ mock: this.config.mock })
  }

  async run() {
    debug('starting run')

    require('./fs')
    const { Updater } = require('./updater')
    const updater = new Updater(this.config)
    debug('checking autoupdater')
    await updater.autoupdate()

    // const {Hooks} = require('./hooks')
    // this.hooks = new Hooks({config: this.config})
    // await this.hooks.run('init')

    if (this.cmdAskingForHelp) {
      debug('running help command')
      this.cmd = await this.Help.run(this.config)
    } else {
      debug('dispatcher')
      const id = this.config.argv[1]
      const { Dispatcher } = require('./dispatcher')
      const dispatcher = new Dispatcher(this.config)
      let { Command, plugin } = await dispatcher.findCommand(id || this.config.defaultCommand || 'help')
      console.dir(plugin)

      if (Command) {
        let { default: Lock } = require('./lock')
        let lock = new Lock(this.config)
        await lock.unread()
        // let opts: PreRunOptions = {
        //   Command,
        //   plugin,
        //   argv: this.config.argv.slice(2)
        // }
        // await this.hooks.run('prerun', opts)
        debug('running cmd')
        if (!Command._version) {
          // old style command
          // flow$ignore
          this.cmd = await Command.run({
            argv: this.config.argv.slice(2),
            config: this.config,
            mock: this.config.mock,
          })
        } else {
          this.cmd = await Command.run(this.config)
        }
      } else {
        let topic = await dispatcher.findTopic(id)
        if (topic) {
          await this.Help.run(this.config)
        } else {
          const { NotFound } = require('./not_found')
          return new NotFound(this.config, this.config.argv).run()
        }
      }
    }

    debug('flushing stdout')
    const { timeout } = require('./util')
    await timeout(this.flush(), 10000)
    debug('exiting')
    cli.exit(0)
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

  get Help() {
    const { default: Help } = this.config.userPlugins ? require('./commands/help') : require('./commands/newhelp')
    return Help
  }
}

export function run(config: ConfigOptions = {}) {
  const cli = new CLI(config)
  return cli.run()
}
