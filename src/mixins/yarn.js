const dirs = require('../lib/dirs')
const fs = require('fs-extra')
const path = require('path')

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

module.exports = superclass => {
  return class extends superclass {
    yarn (...args) {
      const execa = require('execa')
      const cwd = dirs.plugins
      const stdio = this.debugging ? 'inherit' : null
      this.debug(`${cwd}: ${dirs.yarnBin} ${args.join(' ')}`)
      deleteYarnRoadrunnerCache()
      return execa(dirs.yarnBin, args, {cwd, stdio})
    }
  }
}
