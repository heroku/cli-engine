// @flow

import lock from 'rwlockfile'
import path from 'path'

const lockfile = path.join(__dirname, 'integration.lock')

export async function integrationLock () {
  return lock.write(lockfile)
}
