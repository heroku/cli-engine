import Config from '../config'

import { Plugin } from './plugin'

export class MainPlugin extends Plugin {
  constructor(config: Config) {
    const root = config.root!
    const pjson = require(`${root}/package.json`)
    super({ config, type: 'main', root, pjson })
  }

  public get commandsDir() {
    return this.config.commandsDir
  }
}
