import deps from '../deps'
import {IArg, InputFlags, flags as Flags} from 'cli-engine-command'
import {cli} from 'cli-ux'
import {color} from 'heroku-cli-color'
import {Config, ICommand} from 'cli-engine-config'
import {PluginModule, PluginTopic} from './plugin'
import {inspect} from 'util'

export type LegacyTopic = {
}

export type LegacyContext = {
  version: string
  supportsColor: boolean
  auth: {
    password?: string
  }
  debug: boolean
  debugHeaders: boolean
  flags: {[k: string]: string}
  args: string[] | {[k: string]: string}
  app?: string
  org?: string
  team?: string
  config: Config
  apiUrl: string
  herokuDir: string
  apiToken?: string
  apiHost: string
  gitHost: string
  httpGitHost: string
  cwd: string
}

export type LegacyCommand = V5Command

export type AnyTopic = PluginTopic | LegacyTopic
export type AnyCommand = ICommand | LegacyCommand

export type V5Command = {
  topic: string,
  command?: string,
  aliases?: string[],
  variableArgs?: boolean,
  args: IArg[],
  flags: LegacyFlag[],
  description?: string,
  help?: string,
  usage?: string,
  needsApp?: boolean,
  wantsApp?: boolean,
  needsAuth?: boolean,
  needsOrg?: boolean,
  wantsOrg?: boolean,
  hidden?: boolean,
  default?: boolean,
  run: (ctx: LegacyContext) => Promise<any>
}

export type LegacyModule = {
  topics: AnyTopic[]
  commands: AnyCommand[]
}

export type LegacyFlag = {
  name: string,
  description?: string,
  char?: string,
  hasValue?: boolean,
  hidden?: boolean,
  required?: boolean,
  optional?: boolean,
  parse?: any
}

const debug = require('debug')('cli:legacy')

export class PluginLegacy {
  constructor (private config: Config) {}

  public convert (m: PluginModule | LegacyModule): PluginModule {
    m.commands = this.convertCommands(m.commands)
    return m as PluginModule
  }

  private convertCommands (c: AnyCommand[]): ICommand[] {
    return c.map(c => this.convertCommand(c))
  }

  private convertCommand (c: AnyCommand): ICommand {
    if (this.isICommand(c)) return c
    if (this.isV5Command(c)) return this.convertFromV5(c)
    debug(c)
    throw new Error(`Invalid command: ${inspect(c)}`)
  }

private convertFromV5 (c: V5Command): ICommand {
  class V5 extends deps.Heroku.Command {
    static topic = c.topic
    static command = c.command
    static description = c.description
    static hidden = !!c.hidden
    static args = (c.args || []).map(a => ({
      ...a,
      required: a.required !== false && !(a as any).optional
    }))
    static flags = convertFlagsFromV5(c.flags)
    static variableArgs = !!c.variableArgs
    static help = c.help
    static usage = c.usage

    async run () {
      if (c.aliases && c.aliases.length) {
        cli.warn(`Using aliases: ${c.aliases}`)
      }
      const ctx: LegacyContext = {
        version: this.config.userAgent,
        supportsColor: color.enabled,
        auth: {},
        debug: !!this.config.debug,
        debugHeaders: this.config.debug > 1 || ['1', 'true'].includes((<any>process).env.HEROKU_DEBUG_HEADERS),
        flags: this.flags,
        args: c.variableArgs ? this.argv : this.args,
        app: this.flags.app,
        org: this.flags.org,
        team: this.flags.team,
        config: this.config,
        apiUrl: deps.Heroku.vars.apiUrl,
        herokuDir: this.config.cacheDir,
        apiToken: this.heroku.auth,
        apiHost: deps.Heroku.vars.apiHost,
        gitHost: deps.Heroku.vars.gitHost,
        httpGitHost: deps.Heroku.vars.httpGitHost,
        cwd: process.cwd()
      }
      ctx.auth.password = ctx.apiToken
      const ansi = require('ansi-escapes')
      process.once('exit', () => {
        if (process.stderr.isTTY) {
          process.stderr.write(ansi.cursorShow)
        }
      })
      return c.run(ctx)
    }
  }

  if (c.needsApp || c.wantsApp) {
    V5.flags.app = deps.Heroku.flags.app({required: !!c.needsApp})
    V5.flags.remote = deps.Heroku.flags.remote()
  }
  if (c.needsOrg || c.wantsOrg) {
    let opts = {required: !!c.needsOrg, hidden: false, description: 'organization to use'}
    V5.flags.org = deps.Heroku.flags.org(opts)
  }
  return V5
}

  private isICommand(command: AnyCommand): command is ICommand {
    let c = command as ICommand
    return !!(c.id && c._version)
  }

  private isV5Command(command: AnyCommand): command is V5Command {
    let c = command
    return !!(typeof c === 'object')
  }
}

function convertFlagsFromV5 (flags: LegacyFlag[] | InputFlags | undefined): InputFlags {
  if (!flags) return {}
  if (!Array.isArray(flags)) return flags
  return flags.reduce((flags, flag) => {
    let opts = {
      char: flag.char,
      description: flag.description,
      hidden: flag.hidden,
      required: flag.required || flag.optional === false,
      parse: flag.parse
    }
    for (let [k, v] of Object.entries(opts)) {
      if (v === undefined) delete (<any>opts)[k]
    }
    if (!opts.parse) delete opts.parse
    flags[flag.name] = flag.hasValue ? Flags.string(opts as any) : Flags.boolean(opts as any)
    return flags
  }, {} as InputFlags)
}
