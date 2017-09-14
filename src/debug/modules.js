const path = require('path')
const dirs = []
function display (from, to) {
  let dir = path.dirname(fs.realpathSync(to))
  if (dirs.includes(dir)) return
  dirs.push(dir)
  let trunc = dir.split('node_modules').slice(1).join('')
  console.log(`${from}: ${trunc}`)
}

const fs = require('fs')
const Module = require('module').Module
const _load = Module._load
Module._load = (...args) => {
  display(args[0], args[1].id)
  return _load(...args)
}
