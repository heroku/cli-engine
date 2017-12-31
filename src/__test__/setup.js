module.exports = () => {
  const path = require('path')
  const fs = require('fs-extra')

  const testRoot = path.join(__dirname, '../../tmp/test')
  process.env.CLI_ENGINE_DATA_DIR = path.join(testRoot, 'data')
  process.env.CLI_ENGINE_CACHE_DIR = path.join(testRoot, 'cache')
  return fs.remove(testRoot)
}
