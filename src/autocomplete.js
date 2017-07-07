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
                                    .join(' ')
          const flags = publicFlags.length ? ` ${publicFlags}` : ''
          const namespace = p.namespace ? `${p.namespace}:` : ''
          const id = Command.command ? `${Command.topic}:${Command.command}` : Command.topic
          const description = Command.description ? `'${Command.description}'` : ''
          const cmdAndDesc = `'${namespace.replace(/:/, '\\:')}${id.replace(/:/, '\\:')}'${description}`
          if (!flags) return {cmd: cmdAndDesc}
          let cmdFunc = `_${namespace}${id.replace(/:/, '_')} () {
#local -a flags
_flags=(${flags})
#_describe 'flags' flags
}
`
          return {cmd: cmdAndDesc, func: cmdFunc}
        })
      }))
      const cmds = flatten(commands)
      const commandFuncs = cmds.map(c => c.func)
                               .filter(c => c)
                               .concat(this._gen_cmd_list(cmds.map(c => c.cmd)))
                               .join('\n')
      // this.out.log(path.join(this.config.cacheDir, 'completions', 'command_functions'))
      this.out.log(commandFuncs)
      // fs.writeFileSync(path.join(this.config.cacheDir, 'completions', 'commands_functions'), commandFuncs)
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
#_describe -t all-commands 'all commands' list
}
`
    return cmdsList
  }
}
