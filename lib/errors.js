exports.logError = err => {
  const fs = require('fs-extra')
  const util = require('util')
  const dirs = require('./dirs')
  try {
    fs.appendFileSync(dirs.errlog, util.inspect(err) + '\n')
  } catch (err) { console.error(err) }
}
