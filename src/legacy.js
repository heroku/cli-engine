// @flow

import Command, {type Flag, type Arg} from 'cli-engine-command'
import App, {AppFlag, RemoteFlag} from 'cli-engine-command/lib/mixins/app'
import Heroku from 'cli-engine-command/lib/mixins/heroku'

export type LegacyContext = {
  supportsColor: boolean
}

export type LegacyCommand = {
  topic: string,
  command?: string,
  aliases?: string[],
  variableArgs?: boolean,
  args: Arg[],
  flags: Flag[],
  description?: ?string,
  help?: ?string,
  usage?: ?string,
  needsApp?: ?boolean,
  needsAuth?: ?boolean,
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

    run () {
      const ctx = {
        supportsColor: this.color.enabled,
        auth: {},
        debug: this.config.debug,
        flags: this.flags,
        args: c.variableArgs ? this.argv : this.args,
        app: this.app.name
      }
      ctx.auth.password = this.heroku.auth
      return c.run(ctx)
    }
  }
  if (c.needsApp || c.wantsApp) V5.flags.push(AppFlag, RemoteFlag)
  return V5
}
