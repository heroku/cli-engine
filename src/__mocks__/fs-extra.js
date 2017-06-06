// @flow

import path from 'path'
const fs = module.exports = jest.genMockFromModule('fs-extra')

let files = {}

class FileNotFoundError extends Error {
  code: string

  constructor (f: string) {
    super(`ENOENT: ${f}`)
    this.code = 'ENOENT'
  }
}

function find (f) {
  let dir = files[path.dirname(f)]
  if (!dir) throw new FileNotFoundError(f)
  let file = dir[path.basename(f)]
  if (file === undefined) throw new FileNotFoundError(f)
  return file
}

fs.readJSON = async f => {
  let file = find(f)
  return Promise.resolve(file.content || file)
}

fs.statSync = f => find(f)

fs.__files = (f = {}) => { files = f }
