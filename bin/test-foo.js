const path = require('path')
const root = path.join(__dirname, '..', 'test', 'roots', 'test-foo')
const {run} = require('../src/cli')
run({
  config: {
    root,
    updateDisabled: `add update disable message here`
  }
})
