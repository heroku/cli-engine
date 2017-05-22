// @flow

import type Output from 'cli-engine-command/lib/output'
import {type Config} from 'cli-engine-config'
import path from 'path'
import lock from 'rwlockfile'

export default class NPM {
  config: Config
  out: Output
  cwd: string

  static extraOpts: string[] = []

  constructor (output: Output, cwd: string) {
    this.out = output
    this.config = output.config
    this.cwd = cwd
  }

  get lockfile (): string { return path.join(this.config.cacheDir, 'npm.lock') }
  get bin (): string { return path.join(__dirname, '..', '..', 'node_modules', 'npm', 'cli.js') }

  fork (modulePath: string, args: string[] = [], options: any = {}) {
    const {fork} = require('child_process')
    return new Promise((resolve, reject) => {
      let forked = fork(modulePath, args, options)
      let error = ''

      forked.stdout.on('data', (data) => {
        if (this.config.debug) {
          process.stdout.write(data)
        }
      })

      forked.stderr.on('data', (data) => {
        if (this.config.debug) {
          process.stderr.write(data)
        }

        error += data
      })

      forked.on('error', reject)
      forked.on('exit', code => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`npm ${args.join(' ')} exited with code ${code}\n${error}`))
        }
      })
    })
  }

  async exec (args: string[] = []): Promise<void> {
    args = args.concat(['--scripts-prepend-node-path=true'])

    let options = {
      cwd: this.cwd,
      stdio: [null, null, null, 'ipc']
    }

    this.out.debug(`${options.cwd}: ${this.bin} ${args.join(' ')}`)
    let unlock = await lock.write(this.lockfile)
    await this.fork(this.bin, args, options)
    .catch((err) => {
      unlock()
      throw err
    })
    .then(unlock)
  }
}
