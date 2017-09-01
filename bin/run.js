const path = require('path')
const root = path.join(__dirname, '..', 'example')
const {run} = require('../src/cli.js')
run({
  config: {
    root,
    updateDisabled: `add update disable message here`
  }
})
