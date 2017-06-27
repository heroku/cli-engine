// @flow

// TODO: move to its own package

import fs from 'fs-extra'
import moment from 'moment'

export default class {
  static async fetch (cachePath: string, cacheDuration: number, options: any = {}): Promise<?Array<?string>> {
    let cache
    let cachePresent = await fs.exists(cachePath)
    if (cachePresent) {
      if (this._isStale(cachePath, cacheDuration)) {
        // TODO: move this to a fork
        let cache = await options.cacheFn()
        this._updateCache(cachePath, cache)
        // until TODO complete, return fresh cache
        return cache
      }
      cache = await fs.readJSON(cachePath)
      return cache
    }
    cache = await options.cacheFn()
    // TODO: move this to a fork
    this._updateCache(cachePath, cache)
    return cache
  }

  static async _updateCache (cachePath: string, cache: ?any) {
    await fs.ensureFile(cachePath)
    await fs.writeJSON(cachePath, cache)
  }

  static _isStale (cachePath: string, cacheDuration: number): boolean {
    // don't rely on flow to catch this
    // we don't want forever caches
    if (!cacheDuration) return true
    // TODO: test this
    return this._mtime(cachePath).isBefore(moment().subtract(cacheDuration, 'seconds'))
  }

  static _mtime (f) {
    return moment(fs.statSync(f).mtime)
  }
}
