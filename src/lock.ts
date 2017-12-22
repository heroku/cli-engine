import { IConfig } from 'cli-engine-config'
import { cli } from 'cli-ux'
import * as path from 'path'
import deps from './deps'

export class Lock {
  config: IConfig
  lockfile: string

  constructor(config: IConfig, lockfile?: string) {
    this.config = config
    this.lockfile = lockfile || path.join(this.config.cacheDir, 'update.lock')
  }

  // get read lock
  async read() {
    return deps.rwlockfile.read(this.lockfile)
  }

  async unread() {
    await deps.rwlockfile.unread(this.lockfile)
  }

  async canRead() {
    let hasWriter = await deps.rwlockfile.hasWriter(this.lockfile)
    return !hasWriter
  }

  async write() {
    return this.upgrade()
  }

  // upgrade to writer
  async upgrade() {
    // take off reader
    await this.unread()

    // check for other readers
    if (await deps.rwlockfile.hasReaders(this.lockfile)) {
      cli.action.status = `Waiting for all commands to finish`
    }

    // grab writer lock
    let unlock = await deps.rwlockfile.write(this.lockfile)

    // return downgrade function
    return async () => {
      // turn back into reader when unlocking
      await unlock()
      return deps.rwlockfile.read(this.lockfile)
    }
  }
}
