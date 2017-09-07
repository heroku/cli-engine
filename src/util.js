// @flow

const debug = require('debug')('util')

export function compare (...props: any) {
  return (a: any, b: any) => {
    for (let prop of props) {
      if (a[prop] === undefined) return -1
      if (b[prop] === undefined) return 1
      if (a[prop] < b[prop]) return -1
      if (a[prop] > b[prop]) return 1
    }
    return 0
  }
}

export function wait (ms: number, unref: boolean = false): Promise<void> {
  return new Promise(resolve => {
    let t: any = setTimeout(resolve, ms)
    if (unref) t.unref()
  })
}

export function timeout (p: Promise<*>, ms: number): Promise<void> {
  return Promise.race([
    p,
    wait(ms, true).then(() => debug('timed out'))
  ])
}

export function undefault (m: any) {
  return m.default ? m.default : m
}

export function isEmpty (obj: any) {
  // null and undefined are "empty"
  if (obj == null) return true

  // Assume if it has a length property with a non-zero value
  // that that property is correct.
  if (obj.length && obj.length > 0) return false
  if (obj.length === 0) return true

  // Otherwise, does it have any properties of its own?
  // Note that this doesn't handle
  // toString and toValue enumeration bugs in IE < 9
  for (var key in obj) {
    if (hasOwnProperty.call(obj, key)) return false
  }

  return true
}
