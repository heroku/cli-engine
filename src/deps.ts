// remote
import { HTTP } from 'http-call'
import {Help as CLICommandHelp} from 'cli-engine-command/lib/help'

// local
import Hooks = require('./hooks')
import help = require('./commands/help')
import notFound = require('./not_found')
import util = require('./util')

// plugins
import Builtin = require('./plugins/builtin')
import Plugins = require('./plugins')
import linkPlugins = require('./plugins/link')
import userPlugins = require('./plugins/user')
import yarn = require('./plugins/yarn')

export default {
  // remote
  get CLICommandHelp (): typeof CLICommandHelp { return require('cli-engine-command/lib/help').Help },
  get HTTP(): typeof HTTP { return fetch('http-call').HTTP },

  // local
  get Help(): typeof help.default { return fetch('./help').default },
  get Hooks(): typeof Hooks.Hooks { return fetch('./hooks').Hooks },
  get NotFound(): typeof notFound.default { return fetch('./not_found').default },
  get util(): typeof util { return fetch('./util') },

  // plugins
  get Builtin(): typeof Builtin.Builtin { return fetch('./plugins/builtin').Builtin },
  get LinkPlugins(): typeof linkPlugins.LinkPlugins { return fetch('./plugins/link').LinkPlugins },
  get Plugins(): typeof Plugins.Plugins { return fetch('./plugins').Plugins },
  get UserPlugins(): typeof userPlugins.UserPlugins { return fetch('./plugins/user').UserPlugins },
  get Yarn(): typeof yarn.default { return fetch('./plugins/yarn').default },
}

const cache: any = {}

function fetch(s: string) {
  if (!cache[s]) {
    cache[s] = require(s)
  }
  return cache[s]
}
