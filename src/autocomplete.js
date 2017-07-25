// @flow

import path from 'path'
import Output from 'cli-engine-command/lib/output'
import type Command from 'cli-engine-command'
import {type Config} from 'cli-engine-config'
import fs from 'fs-extra'
import Plugins from './plugins'
import {convertFromV5} from './plugins/legacy'
import flatten from 'lodash.flatten'

type CmdCmplData = {
  cmdAndDesc: ?string,
  flagFunc: ?string,
  argFunc: ?string
}

export default class {
  out: Output
  config: Config

  constructor ({config, out}: {config: Config, out: Output}) {
    this.config = config
    this.out = out
  }

  async generateCommandsCache () {
    try {
      const plugins = await new Plugins(this.out).list()
      const cmds = await Promise.all(plugins.map(async (p) => {
        const hydrated = await p.pluginPath.require()
        const cmds = hydrated.commands || []
        return cmds.filter(c => !c.hidden).map(c => {
          const Command = typeof c === 'function' ? c : convertFromV5((c: any))
          const publicFlags = Object.keys(Command.flags || {}).filter(flag => !Command.flags[flag].hidden).map(flag => `--${flag}`).join(' ')
          const flags = publicFlags.length ? ` ${publicFlags}` : ''
          const namespace = p.namespace ? `${p.namespace}:` : ''
          const id = Command.command ? `${Command.topic}:${Command.command}` : Command.topic
          return `${namespace}${id}${flags}`
        })
      }))
      const commands = flatten(cmds).join('\n')
      fs.writeFileSync(path.join(this.config.cacheDir, 'completions', 'commands'), commands)
    } catch (e) {
      this.out.debug('Error creating autocomplete commands')
      this.out.debug(e.message)
    }
  }

  async generateCommandFuncsCache () {
    try {
      const plugins = await new Plugins(this.out).list()
      // for every plugin
      const completions = await Promise.all(plugins.map(async (p) => {
        // re-hydrate
        const hydrated = await p.pluginPath.require()
        const commands = hydrated.commands || []
        // for every command in plugin
        return commands.map(c => {
          if (c.hidden || !c.topic) return
          // TODO: fix here
          // convertFromV5 pukes here w/o topic
          // but we lose this cmd
          const cmd = typeof c === 'function' ? c : convertFromV5((c: any))
          const namespace = (p.namespace || '')
          // create completion setters
          const argFunc = this._createCmdArgSetter(cmd, namespace)
          const flagFunc = this._createCmdFlagSetter(cmd, namespace)
          const cmdAndDesc = this._createCmdWithDescription(cmd, namespace)
          return {argFunc, flagFunc, cmdAndDesc}
        })
      }))
      this._writeShellSetupsToCache()
      this._writeFunctionsToCache(flatten(completions))
    } catch (e) {
      this.out.debug('Error creating autocomplete commands')
      this.out.debug(e.message)
    }
  }

  _writeShellSetupsToCache () {
    const zsh_setup = `
HEROKU_COMMANDS_PATH=${path.join(this.config.cacheDir, 'completions', 'commands')};
HEROKU_AC_SETTERS_PATH=\${HEROKU_COMMANDS_PATH}_functions && test -f $HEROKU_AC_SETTERS_PATH && source $HEROKU_AC_SETTERS_PATH;
fpath=(
${path.join(__dirname, '..', 'autocomplete', 'zsh')}
$fpath
);
autoload -Uz compinit;
compinit;
`
    fs.writeFileSync(path.join(this.config.cacheDir, 'completions', 'zsh_setup'), zsh_setup)
  }

  _createCmdArgSetter (Command: Class<Command<*>>, namespace: string): ?string {
    const id = this._genCmdID(Command, namespace)
    const argscompletions = (Command.args || [])
      .map(arg => { if (arg.completion && !arg.hidden) return arg })
      .filter(arg => arg)
      .map((arg, i) => {
        // make flow happy here
        // even though arg exists
        const name = arg ? arg.name : ''
        const optionalPosition = i === 0 ? '$1' : ''
        const optionalColon = (arg && arg.required) ? '' : ':'
        let evalStatement = `compadd $(echo $(${this.config.bin} autocomplete:values --cmd=$_command_id --resource=${name} --arg))`
        return `"${optionalPosition}${optionalColon}: :{${evalStatement}}"`
      })
      .join('\n')

    if (argscompletions) {
      return `_set_${id.replace(/:/g, '_')}_args () {
_args=(${argscompletions})
}
`
    }
  }

  _createCmdFlagSetter (Command: Class<Command<*>>, namespace: string): ?string {
    const id = this._genCmdID(Command, namespace)
    const flagscompletions = Object.keys(Command.flags || {})
      .filter(flag => !Command.flags[flag].hidden)
      .map(flag => {
        const f = Command.flags[flag]
        const name = f.parse ? `${flag}=-` : flag
        let evalStatement = `compadd $(echo $(${this.config.bin} autocomplete:values --cmd=$_command_id --resource=${flag}))`
        const cachecompl = f.completion ? `: :{${evalStatement}}` : ''
        let completion = `--${name}[${f.parse ? '' : '(bool) '}${f.description}]${cachecompl}`
        return `"${completion}"`
      })
      .join('\n')

    if (flagscompletions) {
      return `_set_${id.replace(/:/g, '_')}_flags () {
_flags=(
${flagscompletions}
)
}
`
    }
  }

  _createCmdWithDescription (Command: Class<Command<*>>, namespace: string): string {
    const description = Command.description ? `:'${Command.description}'` : ''
    return `'${this._genCmdID(Command, namespace).replace(/:/g, '\\:')}'${description}`
  }

  _genCmdID (Command: Class<Command<*>>, namespace: string): string {
    const ns = namespace ? `${namespace}:` : ''
    const id = Command.command ? `${ns}${Command.topic}:${Command.command}` : `${ns}${Command.topic}`
    return id
  }

  _genAllCmdsListSetter (cmds: Array<string>): string {
    return `
_set_all_commands_list () {
_all_commands_list=(
${flatten(cmds).filter(c => c).join('\n')}
)
}
`
  }

  _writeFunctionsToCache (commands: Array<CmdCmplData>) {
    var completionFunctions = []
    var cmdAndDescriptions = []
    commands.map(c => {
      if (!c) return
      if (c.flagFunc) completionFunctions.push(c.flagFunc)
      if (c.argFunc) completionFunctions.push(c.argFunc)
      if (c.cmdAndDesc) cmdAndDescriptions.push(c.cmdAndDesc)
    })
    const allCmds = this._genAllCmdsListSetter(cmdAndDescriptions)
    const completions = completionFunctions.concat(allCmds).join('\n')
    fs.writeFileSync(path.join(this.config.cacheDir, 'completions', 'commands_functions'), completions)
  }
}
