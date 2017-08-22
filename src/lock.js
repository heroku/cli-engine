// @flow

import {type Config} from 'cli-engine-config'
import type Output from 'cli-engine-command/lib/output'
import lock from 'rwlockfile'
import path from 'path'

const debug = require('debug')('cli-engine:lock')

export default class Lock {
  config: Config
  out: Output

  constructor (output: Output) {
    this.out = output
    this.config = output.config
  }

  get updatelockfile (): string { return path.join(this.config.cacheDir, 'update.lock') }

  // get read lock
  async read () {
    debug('read()')
    return lock.read(this.updatelockfile)
  }

  async unread () {
    await lock.unread(this.updatelockfile)
  }

  async canRead () {
    debug('canRead()')
    let hasWriter = await lock.hasWriter(this.updatelockfile)
    return !hasWriter
  }

  // upgrade to writer
  async upgrade () {
    debug('upgrading to writer lock')
    // take off reader
    await this.unread()

    // check for other readers
    if (await lock.hasReaders(this.updatelockfile)) {
      this.out.action.status = `Waiting for all commands to finish`
    }

    // grab writer lock
    let unlock
    try {
      unlock = await lock.write(this.updatelockfile)
      debug('upgraded to writer lock')
    } catch (err) {
      if (err.message.match(/is locked with(.)+reader/)) {
        throw new Error('Command timed out waiting for other active process to finish')
      }
      throw (err)
    }

    // return downgrade function
    return async () => {
      debug('downgrading to reader lock')
      // turn back into reader when unlocking
      await unlock()
      return lock.read(this.updatelockfile)
    }
  }
}
