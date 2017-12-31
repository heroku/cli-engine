import { Hook, IHooks } from '../../../hooks'

export default class PreRun extends Hook<'prerun'> {
  async run(options: IHooks['prerun']) {
    process.env.PRERUN_HOOK_ARGS = options.argv.join(' ')
  }
}
