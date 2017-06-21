// @flow

import Command, {flags} from 'cli-engine-command'
import Plugins from '../../plugins'

export default class AutocompleteValues extends Command {
  static topic = 'autocomplete'
  static commands = 'values'
  static description = 'generates autocomplete values'
  static hidden = true
  static flags = {
    cmd: flags.string({description: '', char: 'c'}),
    flag: flags.string({description: '', char: 'f'}),
    app: flags.string({values: function (): string {
      return 'foo\nbar\nbaz'
    }})
  }

  async run () {
    if (this.config.windows) {
      this.out.error('Autocomplete is not currently supported in Windows')
      return
    }

    if (this.flags.cmd) {
      const plugins = new Plugins(this.out)
      await plugins.load()
      let Command = await plugins.findCommand(this.flags.cmd)
      if (!Command || !this.flags.flag) {
        return
      }
      let long = this.flags.flag.replace(/-+/, '')
      // use this current Command for testing
      this.out.log(this.constructor.flags[long].values() || '')
    }
  }
}
