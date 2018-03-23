import Heroku = require('@heroku-cli/command')
import assync = require('assync')
import * as FS from 'fs-extra'
import globby = require('globby')
import { HTTP } from 'http-call'
import * as klaw from 'klaw'
import * as moment from 'moment'
import semver = require('semver')

import command = require('./command')
import help = require('./commands/help')
import file = require('./file')
import Hooks = require('./hooks')
import notFound = require('./not_found')
import Plugins = require('./plugins')
import pluginLegacy = require('./plugins/legacy')
import pluginManifest = require('./plugins/manifest')
import yarn = require('./plugins/yarn')
import updater = require('./updater')
import util = require('./util')
import validate = require('./validate')

export default {
  // remote
  get HTTP(): typeof HTTP { return fetch('http-call').HTTP },
  get moment(): typeof moment { return fetch('moment') },
  get klaw(): typeof klaw { return fetch('klaw') },
  get Heroku(): typeof Heroku { return fetch('@heroku-cli/command') },
  get semver(): typeof semver { return fetch('semver') },
  get assync(): typeof assync.default { return fetch('assync').default },
  get filesize(): any { return fetch('filesize') },
  get globby(): typeof globby { return fetch('globby') },

  // local
  get Help(): typeof help.default { return fetch('./commands/help').default },
  get Hooks(): typeof Hooks.Hooks { return fetch('./hooks').Hooks },
  get NotFound(): typeof notFound.default { return fetch('./not_found').default },
  get Updater(): typeof updater.Updater { return fetch('./updater').Updater },
  get util(): typeof util { return fetch('./util') },
  get file(): typeof file { return fetch('./file') },
  get fs(): typeof FS { return fetch('fs-extra') },
  get validate(): typeof validate { return fetch('./validate') },

  // plugins
  get Plugins(): typeof Plugins.Plugins { return fetch('./plugins').Plugins },
  get Yarn(): typeof yarn.default { return fetch('./plugins/yarn').default },
  get PluginManifest(): typeof pluginManifest.PluginManifest { return fetch('./plugins/manifest').PluginManifest },
  get PluginLegacy(): typeof pluginLegacy.PluginLegacy { return fetch('./plugins/legacy').PluginLegacy },
  get CommandManager(): typeof command.CommandManager { return fetch('./command').CommandManager },
}

const cache: any = {}

function fetch(s: string) {
  if (s in cache) return cache[s]
  try {
    return cache[s] = require(s)
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
    cache[s] = undefined
  }
}
