// @flow

import path from 'path'
import Output from 'cli-engine-command/lib/output'
import {type Config} from 'cli-engine-config'
import fs from 'fs-extra'
import Plugins from './plugins'
import {convertFromV5} from './plugins/legacy'

export default class {
  out: Output
  config: Config

  constructor ({config, out}: {config: Config, out: Output}) {
    this.config = config
    this.out = out
  }

  async generateCommandsCache () {
    const flatten = require('lodash.flatten')
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
}
