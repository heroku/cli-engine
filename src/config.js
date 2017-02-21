const path = require('path')
let config = {}

function readfile (file) {
  const fs = require('fs-extra')
  try {
    return fs.readFileSync(file, 'utf8').trim()
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
}

config.init = parent => {
  let p = path.join('..', 'package.json')
  let pjson = parent ? parent.require(p) : require(p)
  config.parent = parent
  config.name = pjson.name
  let root = parent ? path.join(parent.filename, '..', '..') : path.join(__dirname, '..')
  config.version = readfile(path.join(root, 'VERSION')) || pjson.version
  config.channel = readfile(path.join(root, 'CHANNEL')) || 'stable'
  pjson['cli-engine'] = pjson['cli-engine'] || {}
  config.bin = pjson['cli-engine'].bin || pjson.name
  config.plugins = pjson['cli-engine'].plugins
  config.defaultCommand = pjson['cli-engine'].default_command || 'help'
  config.s3 = pjson['cli-engine'].s3 || {}
}
config.init()

module.exports = config
