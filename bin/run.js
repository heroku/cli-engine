const path = require('path')
const CLI = require('../src/cli.js').default
const root = path.join(__dirname, '..', 'example')
const cli = new CLI({
  argv: process.argv.slice(1),
  config: {
    root,
    pjson: require(path.join(root, 'package.json')),
    updateDisabled: `add update disable message here`
  }
})
cli.run()
