// remote
import { HTTP } from 'http-call'
import CLICommandHelp = require('cli-engine-command/lib/help')

// local
import notFound = require('./not_found')
import help = require('./commands/help')
import yarn = require('./plugins/yarn')

export default {
  // remote
  get CLICommandHelp (): typeof CLICommandHelp.Help { return require('cli-engine-command/lib/help').Help },
  get HTTP(): typeof HTTP { return fetch('http-call').HTTP },

  // local
  get NotFound(): typeof notFound.default { return fetch('./not_found').default },
  get Help(): typeof help.default { return fetch('./help').default },
  get Yarn(): typeof yarn.default { return fetch('./plugins/yarn').default },
}

const cache: any = {}

function fetch(s: string) {
  if (!cache[s]) {
    cache[s] = require(s)
  }
  return cache[s]
}
