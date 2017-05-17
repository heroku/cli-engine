// @flow

import type Output from 'cli-engine-command/lib/output'
import {type Config} from 'cli-engine-config'
import path from 'path'
import lock from 'rwlockfile'

export default class Yarn {
  config: Config
  out: Output
  cwd: string

  constructor (output: Output, cwd: string) {
    this.out = output
    this.config = output.config
    this.cwd = cwd
  }

  get version (): string { return require('../../package.json')['cli-engine']['yarnDependency'] }
  get lockfile (): string { return path.join(this.config.cacheDir, 'yarn.lock') }
  get bin (): string { return path.join(__dirname, '..', '..', 'yarn', `yarn-${this.version}.js`) }

  fork (modulePath: string, args: string[], options: any) {
    const {fork} = require('child_process')
    return new Promise((resolve, reject) => {
      fork(modulePath, args, options)
      .on('error', reject)
      .on('exit', code => resolve({code}))
    })
  }

  async exec (args: string[] = []): Promise<void> {
    args = ['--non-interactive'].concat(args)

    let options = {
      cwd: this.cwd,
      stdio: this.config.debug ? [0, 1, 2, 'ipc'] : [null, null, null, 'ipc']
    }

    this.out.debug(`${options.cwd}: ${this.bin} ${args.join(' ')}`)
    let unlock = await lock.write(this.lockfile)
    await this.fork(this.bin, args, options)
    await unlock()
  }
}
