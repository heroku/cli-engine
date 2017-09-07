// @flow

import type {Config, Topic} from 'cli-engine-config'
import type Output from 'cli-engine-command/lib/output'
import path from 'path'
import deps from '../deps'

const debug = require('debug')('cli:commands')

export class ConventionalCommandManager extends deps.CommandManagerBase {
  commandsDir: string

  constructor ({config, out, commandsDir}: {
    config: Config, out?: ?Output,
    commandsDir: string
  }) {
    super({config, out})
    this.commandsDir = config.commandsDir
  }

  async listTopics (): Promise<Topic[]> {
    let topics = await this.listTopicIDs()
    return topics
      // add metadata from pjson
      .map(t => this.config.topics[t] || {name: t})
  }

  async listCommandIDs (): Promise<string[]> {
    let commands = await this._listCommandPaths()
    return commands
      // strip off the root
      .map(c => path.relative(this.commandsDir, c))
      // strip off the extension
      .map(c => path.join(path.dirname(c), path.basename(c, '.js')))
      // join with ':'
      .map(c => c.split(path.sep).join(':'))
  }

  async findCommand (id: string) {
    let p
    try {
      debug(`finding ${id} command`)
      p = require.resolve(path.join(this.commandsDir, ...id.split(':')))
    } catch (err) {
      if (err.code !== 'MODULE_NOT_FOUND') throw err
    }
    if (p) return this.require(p, id)
  }

  _listCommandPaths (): Promise<string[]> {
    let commands: string[] = []
    return new Promise((resolve, reject) => {
      const filter = item => {
        // exclude hidden directories
        let basename = path.basename(item)
        return basename === '.' || basename[0] !== '.'
      }

      deps.klaw(this.commandsDir, {filter, depthLimit: 20})
        .on('error', reject)
        .on('end', () => resolve(commands))
        .on('data', d => {
          if (path.extname(d.path) !== '.js') return
          commands.push(d.path)
        })
    })
  }
}
