// @flow

import type {Config} from 'cli-engine-config'
import {CLI} from 'cli-ux'
import path from 'path'
import fs from 'fs-extra'

const debug = require('debug')('cli:yarn')

export default class Yarn {
  config: Config
  cli: CLI
  cwd: string

  static extraOpts: string[] = []

  constructor (config: Config, cwd: string) {
    this.config = config
    this.cli = new CLI({mock: config.mock})
    this.cwd = cwd
  }

  get bin (): string { return path.join(__dirname, '..', '..', 'yarn', `yarn.js`) }

  // https://github.com/yarnpkg/yarn/blob/master/src/constants.js#L73-L90
  pathKey (env: {[k: string]: ?string} = process.env): string {
    let pathKey = 'PATH'

    // windows calls its path "Path" usually, but this is not guaranteed.
    if (this.config.windows) {
      pathKey = 'Path'
      for (const key in env) {
        if (key.toLowerCase() === 'path') {
          pathKey = key
        }
      }
    }
    return pathKey
  }

  // https://github.com/yarnpkg/yarn/blob/master/src/util/execute-lifecycle-script.js#L130-L154
  pathEnv (): {[string]: string} {
    let pathKey = this.pathKey()
    const pathParts = (process.env[pathKey] || '').split(path.delimiter)
    pathParts.unshift(path.dirname(process.execPath))

    const env = {}
    env[pathKey] = pathParts.join(path.delimiter)
    return env
  }

  fork (modulePath: string, args: string[] = [], options: any = {}): Promise<void> {
    const {fork} = require('child_process')
    return new Promise((resolve, reject) => {
      let forked = fork(modulePath, args, options)
      let error = ''

      forked.stdout.setEncoding('utf8')
      forked.stdout.on('data', (data) => {
        if (this.config.debug) {
          this.cli.stdout.write(data)
        }
      })

      forked.stderr.setEncoding('utf8')
      forked.stderr.on('data', (data) => {
        if (this.config.debug) {
          this.cli.stderr.write(data)
        }

        error += data
      })

      forked.on('error', reject)
      forked.on('exit', code => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`yarn ${args.join(' ')} exited with code ${code}\n${error}`))
        }
      })

      // Fix windows bug with node-gyp hanging for input forever
      if (this.config.windows) {
        forked.stdin.write('\n')
      }
    })
  }

  async exec (args: string[] = []): Promise<void> {
    if (args.length !== 0) await this.checkForYarnLock()
    args = args.concat([
      '--non-interactive',
      ...Yarn.extraOpts
    ])
    if (global.yarnCacheDir !== false) {
      let cacheDir = global.yarnCacheDir || path.join(this.config.cacheDir, 'yarn')
      args = args.concat([`--mutex=file:${cacheDir}`, `--cache-folder=${cacheDir}`])
    }

    let options = {
      cwd: this.cwd,
      stdio: [null, null, null, 'ipc'],
      env: {
        ...process.env,
        ...this.pathEnv(),
        YARN_REGISTRY: this.config.npmRegistry
      }
    }

    debug(`${options.cwd}: ${this.bin} ${args.join(' ')}`)
    try {
      await this.fork(this.bin, args, options)
      debug('done')
    } catch (err) {
      // TODO: https://github.com/yarnpkg/yarn/issues/2191
      let networkConcurrency = '--network-concurrency=1'
      if (err.message.includes('EAI_AGAIN') && !args.includes(networkConcurrency)) {
        debug('EAI_AGAIN')
        return this.exec(args.concat(networkConcurrency))
      } else throw err
    }
  }

  async checkForYarnLock () {
    // add yarn lockfile if it does not exist
    if (this.cwd && !fs.existsSync(path.join(this.cwd, 'yarn.lock'))) {
      await this.exec()
    }
  }
}
