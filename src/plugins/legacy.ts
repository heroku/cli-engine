import { flags as Flags } from 'cli-engine-command'
import { ICommand, IConfig } from 'cli-engine-config'
import { args as Args } from 'cli-flags'
import { cli } from 'cli-ux'
import { color } from 'heroku-cli-color'
import { inspect } from 'util'
import deps from '../deps'
import { IPluginModule, IPluginTopic } from './plugin'

export interface ILegacyTopic {
  name?: string
  id?: string
  topic?: string
}

export interface ILegacyContext {
  version: string
  supportsColor: boolean
  auth: {
    password?: string
  }
  debug: boolean
  debugHeaders: boolean
  flags: { [k: string]: string }
  args: string[] | { [k: string]: string }
  app?: string
  org?: string
  team?: string
  config: IConfig
  apiUrl: string
  herokuDir: string
  apiToken?: string
  apiHost: string
  gitHost: string
  httpGitHost: string
  cwd: string
}

export interface IFlowCommand {
  id: string
}

export type LegacyCommand = IV5Command | IFlowCommand

export type AnyTopic = IPluginTopic | ILegacyTopic
export type AnyCommand = ICommand | LegacyCommand

export interface IV5Command {
  topic: string
  command?: string
  aliases?: string[]
  variableArgs?: boolean
  args: Args.IArg[]
  flags: ILegacyFlag[]
  description?: string
  help?: string
  usage?: string
  needsApp?: boolean
  wantsApp?: boolean
  needsAuth?: boolean
  needsOrg?: boolean
  wantsOrg?: boolean
  hidden?: boolean
  default?: boolean
  run: (ctx: ILegacyContext) => Promise<any>
}

export interface ILegacyModule {
  topics: AnyTopic[]
  commands: AnyCommand[]
}

export interface ILegacyFlag {
  name: string
  description?: string
  char?: string
  hasValue?: boolean
  hidden?: boolean
  required?: boolean
  optional?: boolean
  parse?: any
}

const debug = require('debug')('cli:legacy')

export class PluginLegacy {
  constructor(_: IConfig) {}

  public convert(m: IPluginModule | ILegacyModule): IPluginModule {
    m.commands = this.convertCommands(m.commands)
    return m as IPluginModule
  }

  private convertCommands(c: AnyCommand[]): ICommand[] {
    return c.map(c => this.convertCommand(c))
  }

  private convertCommand(c: AnyCommand): ICommand {
    if (this.isICommand(c)) return c
    if (this.isV5Command(c)) return this.convertFromV5(c)
    if (this.isFlowCommand(c)) return this.convertFromFlow(c)
    debug(c)
    throw new Error(`Invalid command: ${inspect(c)}`)
  }

  private convertFromFlow(c: any): ICommand {
    c._version = '0.0.0'
    return c
  }

  private convertFromV5(c: IV5Command): ICommand {
    class V5 extends deps.Heroku.Command {
      static topic = c.topic
      static command = c.command
      static description = c.description
      static hidden = !!c.hidden
      static args = (c.args || []).map(a => ({
        ...a,
        required: a.required !== false && !(a as any).optional,
      }))
      static flags = convertFlagsFromV5(c.flags)
      static variableArgs = !!c.variableArgs
      static help = c.help
      static usage = c.usage

      async run() {
        if (c.aliases && c.aliases.length) {
          cli.warn(`Using aliases: ${c.aliases}`)
        }
        const ctx: ILegacyContext = {
          apiHost: deps.Heroku.vars.apiHost,
          apiToken: this.heroku.auth,
          apiUrl: deps.Heroku.vars.apiUrl,
          app: this.flags.app,
          args: c.variableArgs ? this.argv : this.args,
          auth: {},
          config: this.config,
          cwd: process.cwd(),
          debug: !!this.config.debug,
          debugHeaders: this.config.debug > 1 || ['1', 'true'].includes((process as any).env.HEROKU_DEBUG_HEADERS),
          flags: this.flags,
          gitHost: deps.Heroku.vars.gitHost,
          herokuDir: this.config.cacheDir,
          httpGitHost: deps.Heroku.vars.httpGitHost,
          org: this.flags.org,
          supportsColor: color.enabled,
          team: this.flags.team,
          version: this.config.userAgent,
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
      V5.flags.app = deps.Heroku.flags.app({ required: !!c.needsApp })
      V5.flags.remote = deps.Heroku.flags.remote()
    }
    if (c.needsOrg || c.wantsOrg) {
      let opts = { required: !!c.needsOrg, hidden: false, description: 'organization to use' }
      V5.flags.org = deps.Heroku.flags.org(opts)
    }
    return V5
  }

  private isICommand(command: AnyCommand): command is ICommand {
    let c = command as ICommand
    return !!(c.id && c._version)
  }

  private isV5Command(command: AnyCommand): command is IV5Command {
    let c = command
    return !!(typeof c === 'object')
  }

  private isFlowCommand(command: AnyCommand): command is IFlowCommand {
    let c = command as IFlowCommand
    return !!(!('_version' in c) && c.id)
  }
}

function convertFlagsFromV5(flags: ILegacyFlag[] | Flags.Input | undefined): Flags.Input {
  if (!flags) return {}
  if (!Array.isArray(flags)) return flags
  return flags.reduce(
    (flags, flag) => {
      let opts = {
        char: flag.char,
        description: flag.description,
        hidden: flag.hidden,
        parse: flag.parse,
        required: flag.required || flag.optional === false,
      }
      for (let [k, v] of Object.entries(opts)) {
        if (v === undefined) delete (opts as any)[k]
      }
      if (!opts.parse) delete opts.parse
      flags[flag.name] = flag.hasValue ? Flags.string(opts as any) : Flags.boolean(opts as any)
      return flags
    },
    {} as Flags.Input,
  )
}
