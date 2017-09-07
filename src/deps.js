// @flow

const deps = {
  // external
  get HTTP () { return require('http-call').default },
  get Output () { return require('cli-engine-command/lib/output').default },
  get findUp () { return require('find-up') },
  get klaw () { return require('klaw') },
  get moment () { return require('moment') },
  get uniq () { return require('lodash.uniq') },
  get sortedUniqBy () { return require('lodash.sorteduniqby') },
  get sortBy () { return require('lodash.sortby') },
  get CLICommandHelp () { return require('cli-engine-command/lib/help').default },

  // local
  get CommandManagerBase () { return require('./command_managers/base').CommandManagerBase },
  get Plugins () { return require('./plugins').default },
  get Help () { return require('./commands/help').default },
  get Hooks () { return require('./hooks').Hooks },
  get Lock () { return require('./lock').default },
  get NotFound () { return require('./not_found').NotFound },
  get Updater () { return require('./updater').Updater },
  get util () { return require('./util') }
}

// cache requires
export default new Proxy(deps, {
  get: (target, name) => {
    if (typeof name !== 'string') return target[name]
    const k = '_' + name
    if (!target[k]) {
      target[k] = deps[name]
    }
    return target[k]
  }
})
