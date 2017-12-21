// remote
import {Help as CLICommandHelp} from 'cli-engine-command/lib/help'
import Heroku = require('cli-engine-heroku')
import { HTTP } from 'http-call'
import * as klaw from 'klaw'
import * as moment from 'moment'
import semver = require('semver')
import stripAnsi = require('strip-ansi')

// local
import help = require('./commands/help')
import file = require('./file')
import Hooks = require('./hooks')
import lock = require('./lock')
import notFound = require('./not_found')
import updater = require('./updater')
import util = require('./util')

// plugins
import Plugins = require('./plugins')
import Builtin = require('./plugins/builtin')
import pluginCache = require('./plugins/cache')
import corePlugins = require('./plugins/core')
import pluginLegacy = require('./plugins/legacy')
import linkPlugins = require('./plugins/link')
import pluginManifest = require('./plugins/manifest')
import pluginsMigrate = require('./plugins/migrate')
import userPlugins = require('./plugins/user')
import yarn = require('./plugins/yarn')

export default {
  // remote
  get CLICommandHelp (): typeof CLICommandHelp { return require('cli-engine-command/lib/help').Help },
  get HTTP(): typeof HTTP { return fetch('http-call').HTTP },
  get moment(): typeof moment { return fetch('moment') },
  get rwlockfile(): any { return fetch('rwlockfile') },
  get klaw(): typeof klaw { return fetch('klaw') },
  get crossSpawn(): any { return fetch('cross-spawn') },
  get Heroku(): typeof Heroku { return fetch('cli-engine-heroku') },
  get stripAnsi(): typeof stripAnsi { return fetch('strip-ansi') },
  get semver(): typeof semver { return fetch('semver') },

  // local
  get Help(): typeof help.default { return fetch('./commands/help').default },
  get Hooks(): typeof Hooks.Hooks { return fetch('./hooks').Hooks },
  get Lock(): typeof lock.Lock { return fetch('./lock').Lock },
  get NotFound(): typeof notFound.default { return fetch('./not_found').default },
  get Updater(): typeof updater.Updater { return fetch('./updater').Updater },
  get util(): typeof util { return fetch('./util') },
  get file(): typeof file { return fetch('./file') },

  // plugins
  get Builtin(): typeof Builtin.Builtin { return fetch('./plugins/builtin').Builtin },
  get LinkPlugins(): typeof linkPlugins.LinkPlugins { return fetch('./plugins/link').LinkPlugins },
  get Plugins(): typeof Plugins.Plugins { return fetch('./plugins').Plugins },
  get UserPlugins(): typeof userPlugins.UserPlugins { return fetch('./plugins/user').UserPlugins },
  get CorePlugins(): typeof corePlugins.CorePlugins { return fetch('./plugins/core').CorePlugins },
  get Yarn(): typeof yarn.default { return fetch('./plugins/yarn').default },
  get PluginManifest(): typeof pluginManifest.PluginManifest { return fetch('./plugins/manifest').PluginManifest },
  get PluginCache(): typeof pluginCache.PluginCache { return fetch('./plugins/cache').PluginCache },
  get PluginLegacy(): typeof pluginLegacy.PluginLegacy { return fetch('./plugins/legacy').PluginLegacy },
  get PluginsMigrate(): typeof pluginsMigrate.PluginsMigrate { return fetch('./plugins/migrate').PluginsMigrate },
}

const cache: any = {}

function fetch(s: string) {
  if (!cache[s]) {
    cache[s] = require(s)
  }
  return cache[s]
}
