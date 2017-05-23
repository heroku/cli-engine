// @flow

import Command, {type Arg, type Flag, BooleanFlag, StringFlag} from 'cli-engine-command'
import {AppFlag, RemoteFlag} from 'cli-engine-command/lib/flags/app'
import OrgFlag from 'cli-engine-command/lib/flags/org'
import Heroku, {vars} from 'cli-engine-command/lib/heroku'

export type LegacyContext = {
  supportsColor: boolean
}

export type LegacyFlag = {
  name: string,
  description?: string,
  char?: string,
  hasValue?: boolean,
  hidden?: boolean,
  required?: boolean,
  optional?: boolean
}

export type LegacyCommand = {
  topic: string,
  command?: string,
  aliases?: string[],
  variableArgs?: boolean,
  args: Arg[],
  flags: LegacyFlag[],
  description?: ?string,
  help?: ?string,
  usage?: ?string,
  needsApp?: ?boolean,
  needsAuth?: ?boolean,
  needsOrg?: ?boolean,
  hidden?: ?boolean,
  default?: ?boolean,
  run: (ctx: LegacyContext) => Promise<any>
}

export function convertFromV5 (c: LegacyCommand): Class<Command<*>> {
  if (!c.topic) throw new Error('command has no topic')
  class V5 extends Command {
    static topic = c.topic
    static command = c.command
    static description = c.description
    static hidden = c.hidden
    static args = c.args || []
    static flags = convertFlagsFromV5(c.flags)
    static variableArgs = !!c.variableArgs
    static help = c.help
    static usage = c.usage

    heroku: Heroku

    run () {
      this.heroku = new Heroku(this.out, {required: false})
      let flags: any = this.flags
      let args: (string[] | {[k: string]: string}) = this.argv
      if (!c.variableArgs) {
        // turn args into object v5 expects
        args = {}
        for (let i = 0; i < this.argv.length; i++) {
          args[this.constructor.args[i].name] = this.argv[i]
        }
      }
      const ctx = {
        supportsColor: this.out.color.enabled,
        auth: {},
        debug: this.config.debug,
        debugHeaders: this.config.debug > 1 || ['1', 'true'].includes(process.env.HEROKU_DEBUG_HEADERS),
        flags,
        args,
        app: flags.app,
        org: flags.org,
        config: this.config,
        apiUrl: vars.apiUrl,
        herokuDir: this.config.cacheDir,
        apiToken: this.heroku.auth,
        apiHost: vars.apiHost,
        gitHost: vars.gitHost,
        httpGitHost: vars.httpGitHost
      }
      ctx.auth.password = ctx.apiToken
      return c.run(ctx)
    }
  }

  if (c.needsApp || c.wantsApp) {
    V5.flags.app = AppFlag({required: !!c.needsApp})
    V5.flags.remote = RemoteFlag()
  }
  if (c.needsOrg || c.wantsOrg) V5.flags.org = OrgFlag({required: !!c.needsOrg})
  return V5
}

export function convertFlagsFromV5 (flags: ?(LegacyFlag[] | {[name: string]: Flag<*>})): {[name: string]: Flag<*>} {
  if (!flags) return {}
  if (!Array.isArray(flags)) return flags
  return flags.reduce((flags, flag) => {
    let opts = {
      char: (flag.char: any),
      description: flag.description,
      hidden: flag.hidden,
      required: flag.required,
      optional: flag.optional
    }
    flags[flag.name] = flag.hasValue ? StringFlag(opts) : BooleanFlag(opts)
    return flags
  }, {})
}
