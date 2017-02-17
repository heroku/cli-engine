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

function init (parent) {
  let p = path.join('..', 'package.json')
  config = parent ? parent.require(p) : require(p)
  config.init = init
  if (parent) {
    config.parent = parent
    let parentRoot = path.join(parent.filename, '..', '..')
    config.version = readfile(path.join(parentRoot, 'VERSION')) || config.version
    config.channel = readfile(path.join(parentRoot, 'CHANNEL'))
  }
  config['cli-engine'] = config['cli-engine'] || {}
  config['cli-engine'].bin = config['cli-engine'].bin || config.name
  module.exports = config
}
init()
