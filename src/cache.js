// @flow

// TODO: move to its own package

import fs from 'fs-extra'
import moment from 'moment'

export default class {
  static async fetch (cachePath: string, cacheDuration: ?number, cacheFn: any): Promise<?Array<?string>> {
    let cache
    let cachePresent = await fs.exists(cachePath)
    if (cachePresent) {
      cache = await fs.readJSON(cachePath)
      if (this._isStale(cachePath, cacheDuration)) this._updateCache(cachePath, cacheFn)
      return cache
    }
    return await this._updateCache(cachePath, cacheFn)
  }

  static async _updateCache (cachePath: string, cacheFn: any): Promise<?Array<?string>> {
    if (!cacheFn) return
    await fs.ensureFile(cachePath)
    let cache = await cacheFn()
    fs.writeJSON(cachePath, cache)
    return cache
  }

  static _isStale (cachePath: string, cacheDuration: ?number): boolean {
    if (!cacheDuration) return false
    return this._mtime(cachePath).isBefore(moment().subtract(cacheDuration, 'seconds'))
  }

  static _mtime (f) {
    return moment(fs.statSync(f).mtime)
  }
}
