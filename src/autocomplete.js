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

  async generateCommandFuncs () {
    try {
      const plugins = await new Plugins(this.out).list()
      const completions = await Promise.all(plugins.map(async (p) => {
        // let yes
        // if (p.topics.find(t => t.topic === 'autocomplete')) yes = 1
        const hydrated = await p.pluginPath.require()
        const commands = hydrated.commands || []
        // if (yes) console.log(commands[0])
        return commands.map(c => {
          if (c.hidden || !c.topic) return
          // TODO: fix here
          // convertFromV5 pukes here w/o topic
          // but we lose this cmd
          const cmd = typeof c === 'function' ? c : convertFromV5((c: any))
          return this._createCompletionsForCmd(cmd, (p.namespace || ''))
        })
      }))
      this._writeFunctionsToCache(flatten(completions))
    } catch (e) {
      console.log(e.message)
      this.out.debug('Error creating autocomplete commands')
      this.out.debug(e.message)
    }
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
    const completions = completionFunctions.concat(this._genAllCmdsListSetter(cmdAndDescriptions)).join('\n')
    fs.writeFileSync(path.join(this.config.cacheDir, 'completions', 'commands_functions'), completions)
  }

  _createCompletionsForCmd (Command: Class<Command<*>>, namespace: string = ''): CmdCmplData {
    const id = Command.command ? `${Command.topic}:${Command.command}` : Command.topic
    const description = Command.description ? `:'${Command.description}'` : ''
    const flags = Object.keys(Command.flags || {})
      .filter(flag => !Command.flags[flag].hidden)
      .map(flag => {
        const f = Command.flags[flag]
        const name = f.parse ? `${flag}=-` : flag
        const cachecompl = f.completion ? `: :_get_${flag}s` : ''
        let completion = `--${name}[${f.parse ? '' : '(bool) '}${f.description}]${cachecompl}`
        return `'${completion}'`
      })
    const args = (Command.args || []).filter(arg => !arg.hidden)
      .map(arg => {
        // TODO: make this dynamic
        // when we have reusable args
        // if (args.completions) etc...
        if (arg.name === 'app' || arg.name === 'addon') return arg
      }).filter(a => a)
    return this._createCmdCmplFunctions(id, description, namespace, flags, args)
  }

  _createCmdCmplFunctions (id: string, description: string, namespace: string, flags: Array<*>, args: Array<*>): CmdCmplData {
    const cmdAndDesc = `'${namespace.replace(/:/g, '\\:')}${id.replace(/:/g, '\\:')}'${description}`
    let completions = {}
    completions.cmdAndDesc = cmdAndDesc
    if (flags.length) {
      completions.flagFunc = `_set_${namespace}${id.replace(/:/g, '_')}_flags () {
_flags=(
${flags.join('\n')}
)
}
`
    }
    if (args.length) {
      let n = 1
      let argscompletions = args.map(a => {
        n += 1
        // TODO: how do we ensure this func exists?
        return `'${n}${a.required ? '' : ':'}: :_get_${a.name}s'`
      }).join('\n')
      completions.argFunc = `_set_${namespace}${id.replace(/:/g, '_')}_args () {
_args=(${argscompletions})
}
`
    }
    return completions
  }
}
