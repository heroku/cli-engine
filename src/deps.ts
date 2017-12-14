// remote
import { HTTP } from 'http-call'

// local
import notFound = require('./not_found')

export default {
  // remote
  get HTTP(): typeof HTTP {
    return fetch('http-call').HTTP
  },

  // local
  get NotFound(): typeof notFound.default {
    return fetch('./not_found').default
  },
}

const cache: any = {}

function fetch(s: string) {
  if (!cache[s]) {
    cache[s] = require(s)
  }
  return cache[s]
}
