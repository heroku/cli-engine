import { cli } from 'cli-ux'
import * as path from 'path'

import Config from './config'
import deps from './deps'

export class Lock {
  lockfile: string
  actuallyUnlock?: () => Promise<void>
  private numWriters = 0
  private numReaders = 0
  private debug: any

  constructor(private config: Config, lockfile?: string) {
    this.config = config
    this.lockfile = lockfile || path.join(this.config.cacheDir, 'update.lock')
    this.debug = require('debug')('cli:lock')
  }

  get status(): 'write' | 'read' | undefined {
    if (this.numWriters) return 'write'
    if (this.numReaders) return 'read'
  }

  // get read lock
  async read() {
    this.debug(`+read ${this.numReaders + 1} ${this.numWriters}`, this.lockfile)
    if (!this.status) await deps.rwlockfile.read(this.lockfile)
    this.numReaders++
  }

  async unread() {
    this.debug(`-read ${this.numReaders - 1} ${this.numWriters}`, this.lockfile)
    if (this.status !== 'read') throw new Error(`has ${this.status} lock`)
    await deps.rwlockfile.unread(this.lockfile)
    this.numReaders--
  }

  async unwrite() {
    this.debug(`-write ${this.numReaders} ${this.numWriters - 1}`, this.lockfile)
    if (this.status !== 'write') return
    if (this.numWriters === 1) await this.actuallyUnlock!()
    this.numWriters--
  }

  async canRead() {
    let hasWriter = await deps.rwlockfile.hasWriter(this.lockfile)
    return !hasWriter
  }

  async write() {
    this.debug(`+write ${this.numReaders - 1} ${this.numWriters + 1}`, this.lockfile)
    if (this.numReaders) {
      // take off reader
      await deps.rwlockfile.unread(this.lockfile)
    }
    if (this.numWriters) return
    this.numWriters++

    // check for other readers
    let prevStatus
    if (await deps.rwlockfile.hasReaders(this.lockfile)) {
      prevStatus = cli.action.status
      cli.action.status = `Waiting for all commands to finish`
    }

    // grab writer lock
    let unlock = await deps.rwlockfile.write(this.lockfile)
    if (prevStatus) cli.action.status = prevStatus

    // return downgrade function
    this.actuallyUnlock = async () => {
      // turn back into reader when unlocking
      await unlock()
      if (this.numReaders) return deps.rwlockfile.read(this.lockfile)
    }
  }
}
