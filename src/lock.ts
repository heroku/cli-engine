import {Config} from 'cli-engine-config'
import * as path from 'path'
import {cli} from 'cli-ux'

const lock = require('rwlockfile')

export default class Lock {
  config: Config

  constructor (config: Config) {
    this.config = config
  }

  get updatelockfile (): string { return path.join(this.config.cacheDir, 'update.lock') }

  // get read lock
  async read () {
    return lock.read(this.updatelockfile)
  }

  async unread () {
    await lock.unread(this.updatelockfile)
  }

  async canRead () {
    let hasWriter = await lock.hasWriter(this.updatelockfile)
    return !hasWriter
  }

  // upgrade to writer
  async upgrade () {
    // take off reader
    await this.unread()

    // check for other readers
    if (await lock.hasReaders(this.updatelockfile)) {
      cli.action.status = `Waiting for all commands to finish`
    }

    // grab writer lock
    let unlock = await lock.write(this.updatelockfile)

    // return downgrade function
    return async () => {
      // turn back into reader when unlocking
      await unlock()
      return lock.read(this.updatelockfile)
    }
  }
}
