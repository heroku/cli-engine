import { Hook } from '../../../hooks'

export default class PreRun extends Hook<'prerun'> {
  async run() {
    process.env.PRERUN_HOOK_ARGS = this.options.argv.join(' ')
  }
}
