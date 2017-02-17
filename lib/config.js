const path = require('path')

module.exports = require(path.join('..', 'package.json'))
module.exports.init = parent => {
  module.exports = parent.require(path.join('..', 'package.json'))
  module.exports.parent = parent
}
