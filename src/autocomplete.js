// @flow

import path from 'path'
import Output from 'cli-engine-command/lib/output'
import {type Config} from 'cli-engine-config'
import fs from 'fs-extra'
import Plugins from './plugins'
import {convertFromV5} from './plugins/legacy'
import flatten from 'lodash.flatten'

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
        const hydrated = await p.pluginPath.require()
        const commands = hydrated.commands || []
        return commands.map(c => {
          if (c.hidden) return
          return this._createCompletions(c, (p.namespace || ''))
        })
      }))
      this._writeFunctionsToCache(flatten(completions))
    } catch (e) {
      this.out.debug('Error creating autocomplete commands')
      this.out.debug(e.message)
    }
  }

  _gen_cmd_list (cmds: Array<string>) : string {
    return `
_set_all_commands_list () {
_all_commands_list=(
${flatten(cmds).filter(c => c).join('\n')}
)
}
`
  }

  _writeFunctionsToCache(commands: Array<*>) {
    var completionFunctions = []
    var cmdAndDescriptions = []
    commands.map(c => {
      if (!c) return
      if (c.flagFunc) completionFunctions.push(c.flagFunc)
      if (c.argFunc) completionFunctions.push(c.argFunc)
      if (c.cmdAndDesc) cmdAndDescriptions.push(c.cmdAndDesc)
    })
    const completions = completionFunctions.concat(this._gen_cmd_list(cmdAndDescriptions)).join('\n')
    fs.writeFileSync(path.join(this.config.cacheDir, 'completions', 'commands_functions'), completions)
  }

  _createCompletions(c: any, namespace: string='') : {} {
    // todo: fix here
    // convertFromV5 pukes here w/o topic
    // but we lose this cmd
    if (!c.topic) { return {} }
    const Command = typeof c === 'function' ? c : convertFromV5((c: any))
    const id = Command.command ? `${Command.topic}:${Command.command}` : Command.topic
    const description = Command.description ? `:'${Command.description}'` : ''
    const flags = Object.keys(Command.flags || {})
                              .filter(flag => !Command.flags[flag].hidden)
                              .map(flag => {
                                const f = Command.flags[flag]
                                const name = f.parse ? `${flag}=-` : flag
                                const cachecompl = f.completion ? `: :_get_${flag}s` : ''
                                let completion = `--${name}[${f.parse ? '' : '(bool) '}${f.description}]${cachecompl}`
                                return `\'${completion}\'`
                              })
    const args = (Command.args || []).filter(arg => !arg.hidden)
                                      .map(arg => {
                                        // todo: make this dynamic
                                        // when we have reusable args
                                        // if (args.completions) etc...
                                        if (arg.name === 'app') return arg
                                      }).filter(a => a)
    return this._writeFunctionToString(id, description, namespace, flags, args)
  }

  _writeFunctionToString (id: string, description: string, namespace: string, flags: Array<*>, args: Array<*>) : {} {
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
      // todo: how do we ensure this func exists?
      return `\'${n}${!!a.required ? '' : ':'}: :_get_${a.name}s\'`
    }).join('\n')
    completions.argFunc = `_set_${namespace}${id.replace(/:/g, '_')}_args () {
_args=(${argscompletions})
}
`
  }
    return completions
  }
}
