import lodash = require('lodash')

export default {
  get compact(): typeof lodash.compact { return fetch('lodash/compact') },
  get mapValues(): typeof lodash.mapValues { return fetch('lodash/mapValues') },
  get pick(): typeof lodash.pick { return fetch('lodash/pick') },
  get set(): typeof lodash.set { return fetch('lodash/set') },
  get sortBy(): typeof lodash.sortBy { return fetch('lodash/sortBy') },
  get sortedUniqBy(): typeof lodash.sortedUniqBy { return fetch('lodash/sortedUniqBy') },
  get uniq(): typeof lodash.uniq { return fetch('lodash/uniq') },
  get zipObject(): typeof lodash.zipObject { return fetch('lodash/zipObject') },
}

const cache: any = {}

function fetch(s: string) {
  if (!cache[s]) {
    cache[s] = require(s)
  }
  return cache[s]
}
