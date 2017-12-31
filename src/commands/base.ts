import Command from '@cli-engine/command'

import Config from '../config'

export default abstract class BuiltinCommand extends Command {
  config: Config
}
