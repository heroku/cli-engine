// @flow

import type Output from 'cli-engine-command/lib/output'
import {type Config} from 'cli-engine-config'
import path from 'path'
import lock from 'rwlockfile'

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
  get lockfile (): string { return path.join(this.config.cacheDir, 'yarn.lock') }
  get bin (): string { return path.join(__dirname, '..', '..', 'yarn', `yarn-${this.version}.js`) }

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
          reject(new Error(`yarn ${args.join(' ')} exited with code ${code}\n${error}`))
        }
      })
    })
  }

  async exec (args: string[] = []): Promise<void> {
    args = args.concat(['--non-interactive']).concat(Yarn.extraOpts)

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
