// @flow

import path from 'path'
import {Base} from 'cli-engine-command'

export default class Yarn extends Base {
  get bin (): string { return path.join(__dirname, '..', 'node_modules', '.bin', 'yarn') }
  exec (...args: string[]) {
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

    const execa = require('execa')
    const cwd = path.join(this.config.dirs.data, 'plugins')
    const stdio = this.config.debug ? 'inherit' : null
    this.debug(`${cwd}: ${this.bin} ${args.join(' ')}`)
    deleteYarnRoadrunnerCache()
    return execa(this.bin, args, {cwd, stdio})
  }
}
