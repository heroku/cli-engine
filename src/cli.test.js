// @flow

/* globals
   test
   beforeEach
 */

import cli from './cli'

beforeEach(function () {
  this.log = console.log
  this.argv = process.argv
  this.exit = process.exit
})

afterEach(function () {
  console.log = this.log
  process.exit = this.exit
  process.argv = this.argv
})

test('runs the version command', async function () {
  this.output = ''
  console.log = output => { this.output += output + '\n' }
  // process.exit = code => { this.code = code }
  process.argv = ['node', 'heroku', 'version']
  await cli()
  console.log = this.log
  this.output.should.match(/^cli-engine/)
  this.code.should.eq(0)
})
