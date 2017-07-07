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
      const commands = await Promise.all(plugins.map(async (p) => {
        const hydrated = await p.pluginPath.require()
        const cmds = hydrated.commands || []
        return cmds.filter(c => !c.hidden).map(c => {
          const Command = typeof c === 'function' ? c : convertFromV5((c: any))
          const publicFlags = Object.keys(Command.flags || {})
                                    .filter(flag => !Command.flags[flag].hidden)
                                    .map(flag => {
                                      const f = Command.flags[flag]
                                      let completion = `--${flag}[${f.description}]`
                                      // TODO: add short flags
                                      // if (f.char) completion.concat(`-${f.char}[${f.description}]`)
                                      return `\'${completion}\'`
                                    })
                                    .join('\n')
          const flags = publicFlags.length ? ` ${publicFlags}` : ''
          const namespace = p.namespace ? `${p.namespace}:` : ''
          const id = Command.command ? `${Command.topic}:${Command.command}` : Command.topic
          const description = Command.description ? `:'${Command.description}'` : ''
          const cmdAndDesc = `'${namespace.replace(/:/g, '\\:')}${id.replace(/:/g, '\\:')}'${description}`
          let z = {cad: cmdAndDesc, func: undefined, appArg: undefined}
          if (Command.args.find(a => a.name === 'app')) z.appArg = id
          if (!flags) return z
          let cmdFunc = `_${namespace}${id.replace(/:/g, '_')} () {
_flags=(
${flags}
)
}
`
          return Object.assign(z, {func: cmdFunc})
        })
      }))
      const cmds = flatten(commands)
      // grab completion functions
      var commandFuncs = cmds.map(c => c.func).filter(c => c)
      // add single commands list function
      commandFuncs = commandFuncs.concat(this._gen_cmd_list(cmds.map(c => c.cad)))
      // add single commands with arg app list function
      commandFuncs = commandFuncs.concat(this._gen_cmd_with_arg_app(cmds.map(c => c.appArg).filter(c => c)))
      commandFuncs = commandFuncs.join('\n')
      // this.out.log(path.join(this.config.cacheDir, 'completions', 'command_functions'))
      // this.out.log(commandFuncs)
      fs.writeFileSync(path.join(this.config.cacheDir, 'completions', 'commands_functions'), commandFuncs)
    } catch (e) {
      this.out.debug('Error creating autocomplete commands')
      this.out.debug(e.message)
    }
  }

  _gen_cmd_list (cmds: Array<string>) : string {
    const cmdsList = `
_cmds_list () {
_commands_list=(
${flatten(cmds).join('\n')}
)
}
`
    return cmdsList
  }

  _gen_cmd_with_arg_app(cmds: Array<string>) : string {
    const cmdsWithArgApp = `
_cmds_with_arg_app() {
_commands_with_arg_app=(
  ${flatten(cmds).join('\n')}
)
}
`
    return cmdsWithArgApp
  }
}
