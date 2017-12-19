import deps from './deps'
import { color } from 'heroku-cli-color'
import cli from 'cli-ux'
import { Plugins } from './plugins'
import { Command } from 'cli-engine-command'

export default class NotFound extends Command {
  static variableArgs = true

  plugins: Plugins

  async run() {
    this.plugins = new deps.Plugins({ config: this.config })
    await this.plugins.init()

    let closest
    let binHelp = `${this.config.bin} help`
    let id = this.config.argv[0]
    let idSplit = id.split(':')
    if (await this.plugins.findTopic(idSplit[0])) {
      // if valid topic, update binHelp with topic
      binHelp = `${binHelp} ${idSplit[0]}`
      // if topic:COMMAND present, try closest for id
      if (idSplit[1]) closest = this.closest(id)
    } else {
      closest = this.closest(id)
    }

    let perhaps = closest ? `Perhaps you meant ${color.yellow(closest)}\n` : ''
    cli.error(
      `${color.yellow(id)} is not a ${this.config.bin} command.
${perhaps}Run ${color.cmd(binHelp)} for a list of available commands.`,
      { exitCode: 127 },
    )
  }

  private allCommands() {
    let ids = this.plugins.commandIDs
    return ids
    // TODO add aliases
    // return this.commandManager.listCommandIDs().reduce((commands, c) => {
    //   return commands.concat([c.id]).concat(c.aliases || [])
    // }, [])
  }

  private closest(cmd: string) {
    const DCE = require('string-similarity')
    return DCE.findBestMatch(cmd, this.allCommands()).bestMatch.target
  }
}
