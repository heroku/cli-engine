const path = require('path')
const CLI = require('cli-engine').default
const cli = new CLI({
  root: path.join(__dirname, '..'),
  updateDisabled: `add update disable message here`,
  argv: process.argv.slice(1)
})
cli.run()
