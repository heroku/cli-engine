import assync from 'assync'
import cli from 'cli-ux'
import _ from 'ts-lodash'

import Config from './config'
import deps from './deps'
import { Hooks } from './hooks'
import { ITopic, RootTopic, Topic } from './topic'

export type RunFn = (argv: string[]) => Promise<void>
export interface ICommandInfo {
  _version?: string
  id: string
  hidden: boolean
  help: string
  helpLine: [string, string | undefined]
  aliases: string[]
  description: string | undefined
  usage: string | undefined
  plugin: { name: string; version: string }
  run: RunFn
}

export interface ILoadResult {
  topics?: ITopic[]
  commands?: ICommandInfo[]
}

export interface ICommandManager {
  submanagers?(): Promise<ICommandManager[]>
  load?(): Promise<ILoadResult>
}

export class CommandManager {
  private managers = [this.config.plugins]
  private hooks: Hooks
  private debug = require('debug')('cli:command')
  private result: RootTopic
  private _submanagers: ICommandManager[]

  constructor(protected config: Config) {
    this.hooks = new deps.Hooks(this.config)
  }

  public async run(argv: string[]): Promise<any> {
    await this.hooks.run('init')
    const id = argv[2] || 'help'
    await this.load()
    if (this.cmdAskingForHelp(argv)) {
      this.debug('cmdAskingForHelp')
      return this.help(argv.slice(2))
    }
    let cmd = await this.findCommand(id)
    if (!cmd) {
      let topic = await this.findTopic(id)
      if (topic) return this.help([id])
      else return this.notFound(id)
    }
    await this.hooks.run('prerun', { argv, Command: cmd })
    this.debug('running %s', cmd.id)
    let result
    try {
      result = await cmd.run(argv)
    } catch (err) {
      if (err.showHelp) return this.help(argv.slice(2))
      throw err
    }
    this.debug('exited normally')
    return result
  }

  public async help(argv: string[]) {
    await deps.Help.run(argv, this.config)
  }

  public async notFound(id: string) {
    await deps.NotFound.run([id], this.config)
  }

  public async commands(): Promise<ICommandInfo[]> {
    await this.load()
    return _.sortBy(this.result.allCommands, 'id')
  }

  public async rootCommands(): Promise<ICommandInfo[]> {
    await this.load()
    let commands = Object.keys(this.result.commands).map(k => this.result.commands[k])
    return _.sortBy(commands, 'id')
  }

  public async findTopic(id: string): Promise<Topic | undefined> {
    await this.load()
    return this.result.findTopic(id)
  }

  public async findCommand(id: string, must: true): Promise<ICommandInfo>
  public async findCommand(id: string, must?: boolean): Promise<ICommandInfo | undefined>
  public async findCommand(id: string, must?: boolean): Promise<ICommandInfo | undefined> {
    await this.load()
    let cmd = this.result.findCommand(id)
    if (!cmd && must) throw new Error(`${id} not found`)
    return cmd
  }

  public async topics(): Promise<Topic[]> {
    await this.load()
    return this.result.allTopics
  }

  public async rootTopics() {
    await this.load()
    return this.result.subtopics
  }

  private async load(): Promise<void> {
    if (this.result) return
    this.debug('load')
    this.result = new RootTopic()
    await this.hooks.run('init')
    let managers = await this.submanagers()
    let loads = managers.filter(m => m.load).map(m => m.load!().catch(err => cli.warn(err)))
    for (let r of loads) {
      let result = await r
      if (result) this.addResult(result)
    }
    cli.action.stop()
  }

  private async submanagers(): Promise<ICommandManager[]> {
    if (this._submanagers) return this._submanagers
    const fetch = async (managers: ICommandManager[]): Promise<ICommandManager[]> => {
      const submanagers = await assync(managers)
        .filter(m => !!m.submanagers)
        .map(m => Promise.resolve(m.submanagers!()).then(fetch))
        .flatMap()
        .catch(err => {
          cli.warn(err)
          return []
        })
      return [...(managers || []), ...(submanagers || [])]
    }

    this._submanagers = await fetch(this.managers)
    return this._submanagers
  }

  private addResult(result?: ILoadResult) {
    if (!result) return
    this.result.addTopics(result.topics)
    this.result.addCommands(result.commands)
  }

  private cmdAskingForHelp(argv: string[]): boolean {
    for (let arg of argv) {
      if (arg === '--help') return true
      if (arg === '--') return false
    }
    return false
  }
}
