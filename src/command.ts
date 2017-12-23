import assync from 'assync'
import { IConfig } from 'cli-engine-config'
import deps from './deps'
import { Hooks } from './hooks'
import { Plugins } from './plugins'
import { Builtin } from './plugins/builtin'
import { Plugin } from './plugins/plugin'
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
  plugin: Plugin
  run: RunFn
}

export interface ILoadResult {
  topics?: ITopic[]
  commands?: ICommandInfo[]
}

export interface ICommandManager {
  submanagers?(): Promise<ICommandManager[]>
  needsRefresh?(): Promise<boolean>
  refresh?(): Promise<void>
  load?(): Promise<ILoadResult>
}

export class CommandManager {
  private managers = [new Builtin(this.config), new Plugins(this.config)]
  private hooks: Hooks
  private debug = require('debug')('cli:plugins')
  private result = new RootTopic()

  constructor(protected config: IConfig) {
    this.hooks = new deps.Hooks(this.config)
  }

  public async run(argv: string[]): Promise<any> {
    await this.hooks.run('init')
    const id = argv[2]
    await this.load()
    if (this.cmdAskingForHelp(argv)) return this.help(argv)
    let cmd = this.result.findCommand(id)
    if (!cmd) {
      let topic = await this.findTopic(id)
      if (topic) return this.help([id])
      else return this.notFound(id)
    }
    await this.hooks.run('prerun', { argv, Command: cmd })
    this.debug('running %s', cmd.id)
    const result = await cmd.run(argv)
    this.debug('exited normally')
    return result
  }

  public async help(argv: string[]) {
    deps.Help.run(argv, this.config)
  }

  public async notFound(id: string) {
    deps.NotFound.run([id], this.config)
  }

  public async commands(): Promise<ICommandInfo[]> {
    await this.load()
    return this.result.allCommands
  }

  public async rootCommands(): Promise<ICommandInfo[]> {
    await this.load()
    return Object.values(this.result.commands)
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

  private async load(): Promise<void> {
    this.debug('load')
    await this.hooks.run('init')
    let managers = await this.submanagers()
    let managersToRefresh = await this.managersNeedingRefresh(managers)
    if (managersToRefresh.length) await this.refresh(managersToRefresh)
    this.debug('loading all managers')
    let loads = managers.filter(m => m.load).map(m => m.load!())
    for (let r of loads) this.addResult(await r)
  }

  private async refresh(managers: ICommandManager[]) {
    this.debug('refreshing')
    let tasks = managers.map(m => m.refresh!())
    for (let t of tasks) await t
  }

  private async submanagers(): Promise<ICommandManager[]> {
    const fetch = async (managers: ICommandManager[]): Promise<ICommandManager[]> => {
      const submanagers = await assync(managers)
        .filter(m => !!m.submanagers)
        .map(m => Promise.resolve(m.submanagers!()).then(fetch))
        .flatMap()
      return [...(managers || []), ...(submanagers || [])]
    }

    this.debug('fetching command managers')
    const managers = await fetch(this.managers)
    this.debug('received command %d managers', managers.length)
    return managers
  }

  private async managersNeedingRefresh(managers: ICommandManager[]): Promise<ICommandManager[]> {
    this.debug('checking which managers need refreshes')
    managers = managers.filter(m => m.needsRefresh)
    let tasks = await Promise.all(
      managers.filter(m => m.needsRefresh).map(async m => ((await m.needsRefresh!()) ? m : null)),
    )
    return assync<ICommandManager | null>(tasks).compact()
  }

  private addResult(result: ILoadResult) {
    this.result.addTopics(result.topics)
    this.result.addCommands(result.commands)
  }

  private cmdAskingForHelp(argv: string[]): boolean {
    for (let arg of argv) {
      if (['--help', '-h'].includes(arg)) return true
      if (arg === '--') return false
    }
    return false
  }
}
