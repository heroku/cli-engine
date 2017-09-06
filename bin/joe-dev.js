const path = require('path')
const root = path.join(__dirname, '..', 'test', 'roots', 'joe-dev')
const {run} = require('../src/cli')
run({
  config: {
    root,
    updateDisabled: `add update disable message here`
  }
})
