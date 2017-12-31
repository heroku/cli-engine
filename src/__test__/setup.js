module.exports = async () => {
  const path = require('path')
  const fs = require('fs-extra')

  const testRoot = path.join(__dirname, '../../tmp/test')
  await fs.remove(testRoot)
  process.env.CLI_ENGINE_DATA_DIR = path.join(testRoot, 'data')
  process.env.CLI_ENGINE_CACHE_DIR = path.join(testRoot, 'cache')
}
