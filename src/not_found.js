// @flow

import type {Config} from 'cli-engine-config'
import type Output from 'cli-engine-command/lib/output'
import {CommandManager} from './command_managers'
import {Command} from 'cli-engine-command'

export class NotFound extends Command<*> {
  static variableArgs = true

  argv: string[]
  config: Config
  out: Output
  commandManager: CommandManager

  async allCommands (): Promise<string[]> {
    let ids = await this.commandManager.listCommandIDs()
    return ids
    // TODO add aliases
    // return this.commandManager.listCommandIDs().reduce((commands, c) => {
    //   return commands.concat([c.id]).concat(c.aliases || [])
    // }, [])
  }

  async closest (cmd: string) {
    const DCE = require('string-similarity')
    return DCE.findBestMatch(cmd, await this.allCommands()).bestMatch.target
  }

  async isValidTopic (name: string): Promise<boolean> {
    let t = await this.commandManager.findTopic(name)
    return !!t
  }

  async run () {
    this.commandManager = new CommandManager({config: this.config, out: this.out})

    let closest
    let binHelp = `${this.config.bin} help`
    let id = this.config.argv[1]
    let idSplit = id.split(':')
    if (await this.isValidTopic(idSplit[0])) {
      // if valid topic, update binHelp with topic
      binHelp = `${binHelp} ${idSplit[0]}`
      // if topic:COMMAND present, try closest for id
      if (idSplit[1]) closest = await this.closest(id)
    } else {
      closest = await this.closest(id)
    }

    let perhaps = closest ? `Perhaps you meant ${this.out.color.yellow(closest)}\n` : ''
    this.out.error(`${this.out.color.yellow(id)} is not a ${this.config.bin} command.
${perhaps}Run ${this.out.color.cmd(binHelp)} for a list of available commands.`, 127)
  }
}
