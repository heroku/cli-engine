const path = require('path')
const root = path.join(__dirname, '..', 'example')
const {run} = require('../src/cli')
run({
  root,
  updateDisabled: `add update disable message here`
})
