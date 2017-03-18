// @flow

import Command, {type Flag, type Arg} from 'cli-engine-command'
import {AppFlag, RemoteFlag} from 'cli-engine-command/lib/flags/app'
import OrgFlag from 'cli-engine-command/lib/flags/org'
import Heroku from 'cli-engine-command/lib/heroku'

export type LegacyContext = {
  supportsColor: boolean
}

export type LegacyFlag = {
  name: string,
  description?: string,
  char?: string
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

export function convertFromV5 (c: LegacyCommand): Class<Command> {
  if (!c.topic) throw new Error('command has no topic')
  class V5 extends Command {
    static topic = c.topic
    static command = c.command
    static description = c.description
    static hidden = c.hidden
    static args = c.args || []
    static flags = c.flags || []
    static variableArgs = !!c.variableArgs
    static help = c.help

    heroku = new Heroku(this, {required: false})
    app = new App(this, {required: c.needsApp})
    org = new Org(this, {required: c.needsOrg})

    run () {
      const ctx = {
        supportsColor: this.color.enabled,
        auth: {},
        debug: this.config.debug,
        flags: this.flags,
        args: c.variableArgs ? this.argv : this.args,
        app: this.app.name,
        org: this.org.name
      }
      ctx.auth.password = this.heroku.auth
      return c.run(ctx)
    }
  }

  if (c.needsApp || c.wantsApp) V5.flags.push(AppFlag, RemoteFlag)
  if (c.needsOrg || c.wantsOrg) V5.flags.push(OrgFlag)
  return V5
}
