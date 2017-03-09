// @flow

import path from 'path'
import {Base} from 'cli-engine-command'
import lock from 'rwlockfile'

type Info = {
  name: string,
  description: string,
  'dist-tags': {
    [tag: string]: string
  }
}

export default class Yarn extends Base {
  get lockfile (): string { return path.join(this.config.dirs.cache, 'yarn.lock') }

  get nodeModulesDirs (): string[] { return require('find-node-modules')({cwd: __dirname, relative: false}) }
  get yarnDir (): ?string { return this.nodeModulesDirs.map(d => path.join(d, 'yarn')).find(f => this.fs.existsSync(f)) }
  get bin (): ?string { return this.yarnDir ? path.join(this.yarnDir, 'bin', 'yarn') : 'yarn' }

  async exec (args: string[] = [], options: {} = {}): Promise<string> {
    let deleteYarnRoadrunnerCache = () => {
      let getDirectory = (category) => {
        // use %LOCALAPPDATA%/Yarn on Windows
        if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
          return path.join(process.env.LOCALAPPDATA, 'Yarn', category)
        }

        // otherwise use ~/.{category}/yarn
        return path.join(this.config.dirs.home, `.${category}`, 'yarn')
      }

      let getCacheDirectory = () => {
        if (process.platform === 'darwin') {
          return path.join(this.config.dirs.home, 'Library', 'Caches', 'Yarn')
        }

        return getDirectory('cache')
      }

      try {
        this.fs.unlinkSync(path.join(getCacheDirectory(), '.roadrunner.json'))
      } catch (err) {}
    }

    options = Object.assign({
      cwd: path.join(this.config.dirs.data, 'plugins'),
      stdio: this.config.debug ? 'inherit' : null
    }, options)

    if (!this.bin) throw new Error('yarn not found')
    const execa = require('execa')
    this.debug(`${options.cwd}: ${this.bin} ${args.join(' ')}`)
    deleteYarnRoadrunnerCache()
    let unlock = await lock.write(this.lockfile)
    let output = await execa(this.bin, args, options)
    await unlock()
    deleteYarnRoadrunnerCache()
    return output.stdout
  }

  async info (name: string): Promise<Info> {
    let output = await this.exec(['info', name, '--json'], {stdio: null})
    let info: Info = JSON.parse(output)['data']
    return info
  }
}
