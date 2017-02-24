const path = require('path')
const CLI = require('../src/cli.js').default
const cli = new CLI({
  root: path.join(__dirname, '..', 'example'),
  updateDisabled: `add update disable message here`,
  argv: process.argv.slice(1)
})
cli.run()
