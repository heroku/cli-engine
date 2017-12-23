import deps from './deps'
import assync from 'assync'
import {IConfig} from 'cli-engine-config'
import {Builtin} from './plugins/builtin'
import {ITopic, RootTopic} from './topic'
import {Hooks} from './hooks'

export type RunFn = (argv: string[]) => Promise<void>
export interface ICommandInfo {
  id: string
  hidden: boolean
  help: string
  helpLine: [string, string | undefined]
  run: RunFn
}

export interface ILoadResult {
  topics?: ITopic[],
  commands?: ICommandInfo[],
}

export interface ICommandManager {
  submanagers? (): Promise<ICommandManager[]>
  needsRefresh? (): Promise<boolean>
  refresh? (): Promise<void>
  load (): Promise<ILoadResult>
}

export class CommandManager {
  private managers = [
    new Builtin(this.config)
  ]
  private hooks: Hooks
  private debug = require('debug')('cli:plugins')
  private result = new RootTopic()

  constructor (protected config: IConfig) {
    this.hooks = new deps.Hooks(this.config)
  }

  public async run (argv: string[]): Promise<any> {
    await this.hooks.run('init')
    const id = argv[2]
    await this.load()
    let cmd = this.result.findCommand(id)
    if (!cmd) throw new Error(`${id} not found`)
    await this.hooks.run('prerun', { argv, Command: cmd })
    this.debug('running %s', cmd.id)
    const result = await cmd.run(argv)
    this.debug('exited normally')
    return result
  }

  private async load (): Promise<void> {
    this.debug('load')
    await this.hooks.run('init')
    let managers = await this.submanagers()
    let managersToRefresh = await this.managersNeedingRefresh(managers)
    if (managersToRefresh.length) await this.refresh(managersToRefresh)
    this.debug('loading all managers')
    let loads = managers.map(m => m.load())
    for (let r of loads) this.addResult(await r)
  }

  private async refresh (managers: ICommandManager[]) {
    this.debug('refreshing', managers)
    this.debug('get write lock')
    let tasks = managers.map(m => m.refresh!())
    for (let t of tasks) await t
    this.debug('release write lock')
  }

  private async submanagers (): Promise<ICommandManager[]> {
    const fetch = async (managers: ICommandManager[]): Promise<ICommandManager[]> => {
      const submanagers = await (assync(managers)
        .filter(m => !!m.submanagers)
        .map(m => m.submanagers!().then(fetch))
        .flatMap())
      return [...managers, ...submanagers]
    }

    this.debug('fetching command managers')
    const managers = await fetch(this.managers)
    this.debug('received command %d managers', managers.length)
    return managers
  }

  private async managersNeedingRefresh (managers: ICommandManager[]): Promise<ICommandManager[]> {
    this.debug('checking which managers need refreshes')
    managers = managers.filter(m => m.needsRefresh)
    let tasks = await Promise.all(managers
      .filter(m => m.needsRefresh)
      .map(async m => await m.needsRefresh!() ? m : null))
    return assync<ICommandManager | null>(tasks).compact()
  }

  private addResult (result: ILoadResult) {
    this.result.addTopics(result.topics)
    this.result.addCommands(result.commands)
  }
}
