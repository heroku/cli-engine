import CLIConfig, {ICommand} from '@cli-engine/config'
import Heroku = require('@heroku-cli/command')
import assync = require('assync')
import execa = require('execa')
import globby = require('globby')
import { HTTP } from 'http-call'
import * as klaw from 'klaw'
import * as moment from 'moment'
import pkgDir = require('pkg-dir')
import readPkg = require('read-pkg')
import readPkgUp = require('read-pkg-up')
import rwlockfile = require('rwlockfile')
import {Observable} from 'rxjs/Observable'
import semver = require('semver')

import help = require('./commands/help')
import UpdateCommand from './commands/update'
import Config from './config'
import * as Engine from './engine'
import file = require('./file')
import Hooks = require('./hooks')
import notFound = require('./not_found')
import PluginManager = require('./plugins')
import pluginCache = require('./plugins/cache')
import pluginCommands from './plugins/commands'
import pluginLegacy = require('./plugins/legacy')
import LinkPlugin from './plugins/link'
import pluginManifest = require('./plugins/manifest')
import pluginTopics from './plugins/topics'
import UserPlugin from './plugins/user'
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
  get readPkg(): typeof readPkg {return fetch('read-pkg') },
  get readPkgUp(): typeof readPkgUp { return fetch('read-pkg-up') },
  get pkgDir(): typeof pkgDir { return fetch('pkg-dir') },
  get rwlockfile(): typeof rwlockfile { return fetch('rwlockfile') },
  get execa(): typeof execa { return fetch('execa') },
  get npmRunPath(): any { return fetch('npm-run-path') },

  // local
  get Config(): typeof Config { return fetch('./config').default },
  get Engine(): typeof Engine.default { return fetch('./engine').default },
  get Help(): typeof help.default { return fetch('./commands/help').default },
  get Hooks(): typeof Hooks.default { return fetch('./hooks').default },
  get NotFound(): typeof notFound.default { return fetch('./not_found').default },
  get Updater(): typeof updater.Updater { return fetch('./updater').Updater },
  get util(): typeof util { return fetch('./util') },
  get file(): typeof file { return fetch('./file') },
  get validate(): typeof validate { return fetch('./validate') },

  // plugins
  get PluginManager(): typeof PluginManager.default { return fetch('./plugins').default },
  get Yarn(): typeof yarn.default { return fetch('./plugins/yarn').default },
  get PluginCache(): typeof pluginCache.default { return fetch('./plugins/cache').default },
  get PluginManifest(): typeof pluginManifest.default { return fetch('./plugins/manifest').default },
  get PluginLegacy(): typeof pluginLegacy.PluginLegacy { return fetch('./plugins/legacy').PluginLegacy },
  get UpdateCommand(): typeof UpdateCommand { return fetch('./commands/update').default },
  get UserPlugins(): typeof UserPlugin { return fetch('./plugins/user').default },
  get LinkPlugins(): typeof LinkPlugin { return fetch('./plugins/link').default },
  get pluginCommands(): typeof pluginCommands { return fetch('./plugins/commands').default },
  get PluginTopics(): typeof pluginTopics { return fetch('./plugins/topics').default },
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

export {
  Observable,
  CLIConfig,
  ICommand,
}
