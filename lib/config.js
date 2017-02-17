const path = require('path')
const dirs = require('./dirs')

module.exports = require(path.join(dirs.cliRoot, 'package.json'))
