import Config from '../config'

import { Plugin } from './plugin'

export default class MainPlugin extends Plugin {
  constructor(config: Config) {
    const root = config.root!
    super({ config, type: 'main', root })
  }
}
