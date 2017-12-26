import { Command } from '@cli-engine/command'
import cli from 'cli-ux'
import { color } from '@heroku-cli/color'
import { CommandManager } from './command'
import deps from './deps'

export default class NotFound extends Command {
  static variableArgs = true

  cm: CommandManager

  async run() {
    this.cm = new deps.CommandManager(this.config)
    let closest
    let binHelp = `${this.config.bin} help`
    let id = this.argv[0]
    let idSplit = id.split(':')
    if (await this.cm.findTopic(idSplit[0])) {
      // if valid topic, update binHelp with topic
      binHelp = `${binHelp} ${idSplit[0]}`
      // if topic:COMMAND present, try closest for id
      if (idSplit[1]) closest = this.closest(id)
    } else {
      closest = this.closest(id)
    }

    let perhaps = closest ? `Perhaps you meant ${color.yellow(await closest)}\n` : ''
    cli.error(
      `${color.yellow(id)} is not a ${this.config.bin} command.
${perhaps}Run ${color.cmd(binHelp)} for a list of available commands.`,
      { exitCode: 127 },
    )
  }

  private async allCommands() {
    let commands = await this.cm.commands()
    return commands.map(c => c.id)
    // TODO add aliases
    // return this.commandManager.listCommandIDs().reduce((commands, c) => {
    //   return commands.concat([c.id]).concat(c.aliases || [])
    // }, [])
  }

  private async closest(cmd: string) {
    const DCE = require('string-similarity')
    return DCE.findBestMatch(cmd, await this.allCommands()).bestMatch.target
  }
}
