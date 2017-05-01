// @flow

import type Output from 'cli-engine-command/lib/output'
import {type Config} from 'cli-engine-config'
import path from 'path'
import lock from 'rwlockfile'
import fs from 'fs-extra'

export default class Yarn {
  config: Config
  out: Output
  cwd: string

  constructor (output: Output, cwd: string) {
    this.out = output
    this.config = output.config
    this.cwd = cwd
  }

  get lockfile (): string { return path.join(this.config.cacheDir, 'yarn.lock') }
  get nodeModulesDirs (): string[] { return require('find-node-modules')({cwd: __dirname, relative: false}) }
  get yarnDir (): ?string { return this.nodeModulesDirs.map(d => path.join(d, 'yarn')).find(f => fs.existsSync(f)) }
  get bin (): ?string { return this.yarnDir ? path.join(this.yarnDir, 'bin', 'yarn') : 'yarn' }

  async exec (args: string[] = []): Promise<void> {
    let deleteYarnRoadrunnerCache = () => {
      let getDirectory = (category) => {
        // use %LOCALAPPDATA%/Yarn on Windows
        if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
          return path.join(process.env.LOCALAPPDATA, 'Yarn', category)
        }

        // otherwise use ~/.{category}/yarn
        return path.join(this.config.home, `.${category}`, 'yarn')
      }

      let getCacheDirectory = () => {
        if (process.platform === 'darwin') {
          return path.join(this.config.home, 'Library', 'Caches', 'Yarn')
        }

        return getDirectory('cache')
      }

      try {
        fs.unlinkSync(path.join(getCacheDirectory(), '.roadrunner.json'))
      } catch (err) {}
    }

    let options = {
      cwd: this.cwd,
      stdio: this.config.debug ? 'inherit' : null
    }

    if (!this.bin) throw new Error('yarn not found')
    const execa = require('execa')
    this.out.debug(`${options.cwd}: ${this.bin} ${args.join(' ')}`)
    deleteYarnRoadrunnerCache()
    let unlock = await lock.write(this.lockfile)
    await execa(this.bin, args, options)
    await unlock()
    deleteYarnRoadrunnerCache()
  }
}
