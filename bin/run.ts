import * as path from 'path'
const root = path.join(__dirname, '..', 'example')
const {run} = require('../src/cli')
run({
  config: {
    root,
    updateDisabled: `add update disable message here`
  }
})
