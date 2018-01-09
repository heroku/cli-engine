import _ from 'ts-lodash'

import Config, { ICommand, IEngine, ITopic } from './config'
import deps from './deps'
import Hooks from './hooks'
import PluginManager from './plugins'

export default class Engine implements IEngine {
  private _hooks: Hooks
  private _plugins: PluginManager
  private debug = require('debug')('cli:engine')

  constructor(protected config: Config) {}

  get plugins(): PluginManager {
    return this._plugins || (this._plugins = new deps.PluginManager(this.config))
  }
  get hooks(): Hooks {
    return this._hooks || (this._hooks = new deps.Hooks(this.config))
  }
  get commands(): Promise<ICommand[]> {
    return this.plugins.commands.pipe(deps.util.collect).toPromise()
  }
  get commandIDs() {
    return this.plugins.commandIDs.pipe(deps.util.collect).toPromise()
  }
  get topics() {
    return this.plugins.topics.pipe(deps.util.collect).toPromise()
  }
  get rootTopics(): Promise<ITopic[]> {
    return this.plugins.topics
      .filter(t => !t.name.includes(':'))
      .pipe(deps.util.collect)
      .toPromise()
  }

  public async run(argv: string[]): Promise<any> {
    const id = argv[2] || 'help'
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
      result = await cmd.run(argv, this.config)
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

  public async rootCommands(): Promise<ICommand[]> {
    let commands = await this.plugins.commands
      .filter(cmd => !cmd.id.includes(':'))
      .pipe(deps.util.collect)
      .toPromise()
    return _.sortBy(commands, 'id')
  }

  public async findTopic(id: string, must: true): Promise<ITopic>
  public async findTopic(id: string, must?: boolean): Promise<ITopic | undefined>
  public async findTopic(id: string, must?: boolean): Promise<ITopic | undefined> {
    let topic = await this.plugins.topics.find(c => c.name === id).toPromise()
    if (!topic && must) throw new Error(`${id} not found`)
    return topic
  }

  public async findCommand(id: string, must: true): Promise<ICommand>
  public async findCommand(id: string, must?: boolean): Promise<ICommand | undefined>
  public async findCommand(id: string, must?: boolean): Promise<ICommand | undefined> {
    let cmd = await this.plugins.commands.find(c => c.id === id || c.aliases.includes(id)).toPromise()
    if (!cmd && must) throw new Error(`${id} not found`)
    return cmd
  }

  private cmdAskingForHelp(argv: string[]): boolean {
    for (let arg of argv) {
      if (arg === '--help') return true
      if (arg === '--') return false
    }
    return false
  }
}
