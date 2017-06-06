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

export function wait (ms: number) {
  return new Promise(resolve => {
    let t: any = setTimeout(resolve, ms)
    t.unref()
  })
}

export function timeout (p: Promise<*>, ms: number) {
  return Promise.race([
    p,
    wait(ms).then(() => debug('timed out'))
  ])
}
