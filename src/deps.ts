import {Help as CLICommandHelp} from '@cli-engine/command/lib/help'
import Heroku = require('@heroku-cli/command')
import assync = require('assync')
import { HTTP } from 'http-call'
import * as klaw from 'klaw'
import * as moment from 'moment'
import semver = require('semver')
import stripAnsi = require('strip-ansi')

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
  get CLICommandHelp (): typeof CLICommandHelp { return require('@cli-engine/command/lib/help').Help },
  get HTTP(): typeof HTTP { return fetch('http-call').HTTP },
  get moment(): typeof moment { return fetch('moment') },
  get klaw(): typeof klaw { return fetch('klaw') },
  get Heroku(): typeof Heroku { return fetch('@heroku-cli/command') },
  get stripAnsi(): typeof stripAnsi { return fetch('strip-ansi') },
  get semver(): typeof semver { return fetch('semver') },
  get assync(): typeof assync.default { return fetch('assync').default },
  get filesize(): any { return fetch('filesize') },

  // local
  get Help(): typeof help.default { return fetch('./commands/help').default },
  get Hooks(): typeof Hooks.Hooks { return fetch('./hooks').Hooks },
  get NotFound(): typeof notFound.default { return fetch('./not_found').default },
  get Updater(): typeof updater.Updater { return fetch('./updater').Updater },
  get util(): typeof util { return fetch('./util') },
  get file(): typeof file { return fetch('./file') },
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
