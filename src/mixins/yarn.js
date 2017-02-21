// @flow
/* globals
   Class
*/

import dirs from '../dirs'
import fs from 'fs-extra'
import path from 'path'
import type Command from 'cli-engine-command'

function deleteYarnRoadrunnerCache () {
  function getDirectory (category) {
    // use %LOCALAPPDATA%/Yarn on Windows
    if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
      return path.join(process.env.LOCALAPPDATA, 'Yarn', category)
    }

    // otherwise use ~/.{category}/yarn
    return path.join(dirs.home, `.${category}`, 'yarn')
  }

  function getCacheDirectory () {
    if (process.platform === 'darwin') {
      return path.join(dirs.home, 'Library', 'Caches', 'Yarn')
    }

    return getDirectory('cache')
  }

  try {
    fs.unlinkSync(path.join(getCacheDirectory(), '.roadrunner.json'))
  } catch (err) {}
}

export default (superclass: Class<Command>) => {
  return class extends superclass {
    yarn (...args: string[]) {
      const execa = require('execa')
      const cwd = dirs.plugins
      const stdio = this.debugging ? 'inherit' : null
      this.debug(`${cwd}: ${dirs.yarnBin} ${args.join(' ')}`)
      deleteYarnRoadrunnerCache()
      return execa(dirs.yarnBin, args, {cwd, stdio})
    }
  }
}
