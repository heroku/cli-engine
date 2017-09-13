import Lock = require('./lock')
import Moment = require('moment')
import util = require('./util')

import HTTP = require('http-call')

export const deps = {
  // local
  get Lock(): typeof Lock.Lock {
    return fetch('./lock').Lock
  },
  get util(): typeof util {
    return fetch('./util')
  },

  // remote
  get RWLockFile(): any {
    return fetch('rwlockfile')
  },
  get HTTP(): typeof HTTP.HTTP {
    return fetch('http-call').HTTP
  },
  get moment(): typeof Moment {
    return fetch('moment')
  },
}

const cache: any = {}

function fetch(s: string) {
  if (!cache[s]) {
    cache[s] = require(s)
  }
  return cache[s]
}
