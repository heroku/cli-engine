import deps from './deps'
import { Config } from 'cli-engine-config'
import * as path from 'path'
import { cli } from 'cli-ux'

export class Lock {
  config: Config

  constructor(config: Config) {
    this.config = config
  }

  get updatelockfile(): string {
    return path.join(this.config.cacheDir, 'update.lock')
  }

  // get read lock
  async read() {
    return deps.rwlockfile.read(this.updatelockfile)
  }

  async unread() {
    await deps.rwlockfile.unread(this.updatelockfile)
  }

  async canRead() {
    let hasWriter = await deps.rwlockfile.hasWriter(this.updatelockfile)
    return !hasWriter
  }

  // upgrade to writer
  async upgrade() {
    // take off reader
    await this.unread()

    // check for other readers
    if (await deps.rwlockfile.hasReaders(this.updatelockfile)) {
      cli.action.status = `Waiting for all commands to finish`
    }

    // grab writer lock
    let unlock = await deps.rwlockfile.write(this.updatelockfile)

    // return downgrade function
    return async () => {
      // turn back into reader when unlocking
      await unlock()
      return deps.rwlockfile.read(this.updatelockfile)
    }
  }
}
