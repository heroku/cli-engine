import * as path from 'path'
import { Config } from 'cli-engine-config'
import { CLI } from 'cli-ux'
import { deps } from './deps'

export class Lock {
  config: Config
  cli: CLI

  constructor(config: Config) {
    this.config = config
    this.cli = new CLI({ mock: config.mock })
  }

  get updatelockfile(): string {
    return path.join(this.config.cacheDir, 'update.lock')
  }

  // get read lock
  async read() {
    return deps.RWLockFile.read(this.updatelockfile)
  }

  async unread() {
    await deps.RWLockFile.unread(this.updatelockfile)
  }

  async canRead() {
    let hasWriter = await deps.RWLockFile.hasWriter(this.updatelockfile)
    return !hasWriter
  }

  // upgrade to writer
  async upgrade() {
    // take off reader
    await this.unread()

    // check for other readers
    if (await deps.RWLockFile.hasReaders(this.updatelockfile)) {
      this.cli.action.status = `Waiting for all commands to finish`
    }

    // grab writer lock
    let unlock = await deps.RWLockFile.write(this.updatelockfile)

    // return downgrade function
    return async () => {
      // turn back into reader when unlocking
      await unlock()
      return deps.RWLockFile.read(this.updatelockfile)
    }
  }
}
