const path = require('path')
const dirs = require('./dirs')

if (dirs.parentRoot) module.exports = require(path.join(dirs.parentRoot, 'package.json'))
else {
  let pjson = require('../package.json')
  module.exports = {
    name: 'cli-engine',
    version: pjson.version
  }
}
