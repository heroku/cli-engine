// @flow

import type Output from 'cli-engine-command/lib/output'
import {type Config} from 'cli-engine-config'
import path from 'path'
import fs from 'fs-extra'

const debug = require('debug')('cli-engine/plugins/yarn')

export default class Yarn {
  config: Config
  out: Output
  cwd: string

  static extraOpts: string[] = []

  constructor (output: Output, cwd: string) {
    this.out = output
    this.config = output.config
    this.cwd = cwd
  }

  get version (): string { return require('../../package.json')['cli-engine']['yarnDependency'] }
  get bin (): string { return path.join(__dirname, '..', '..', 'yarn', `yarn-${this.version}.js`) }

  // https://github.com/yarnpkg/yarn/blob/master/src/constants.js#L73-L90
  pathKey (env: {[k: string]: ?string} = process.env): string {
    let pathKey = 'PATH'

    // windows calls its path "Path" usually, but this is not guaranteed.
    if (process.platform === 'win32') {
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

  fork (modulePath: string, args: string[] = [], options: any = {}) {
    const {fork} = require('child_process')
    return new Promise((resolve, reject) => {
      let forked = fork(modulePath, args, options)
      let error = ''

      forked.stdout.setEncoding('utf8')
      forked.stdout.on('data', (data) => {
        if (this.config.debug) {
          this.out.stdout.write(data)
        }
      })

      forked.stderr.setEncoding('utf8')
      forked.stderr.on('data', (data) => {
        if (this.config.debug) {
          this.out.stderr.write(data)
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
    })
  }

  async exec (args: string[] = []): Promise<void> {
    if (args.length !== 0) await this.checkForYarnLock()
    args = args.concat(['--non-interactive']).concat(Yarn.extraOpts)
    if (global.yarnCacheDir !== false) {
      let cacheDir = path.join(this.config.cacheDir, 'yarn')
      args = args.concat([`--mutex=file:${cacheDir}`, `--cache-folder=${cacheDir}`])
    }

    let options = {
      cwd: this.cwd,
      stdio: [null, null, null, 'ipc'],
      env: Object.assign({}, process.env, this.pathEnv())
    }

    debug(`${options.cwd}: ${this.bin} ${args.join(' ')}`)
    try {
      await this.fork(this.bin, args, options)
    } catch (err) {
      // TODO: https://github.com/yarnpkg/yarn/issues/2191
      let networkConcurrency = '--network-concurrency=1'
      if (err.message.includes('EAI_AGAIN') && !args.includes(networkConcurrency)) {
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
