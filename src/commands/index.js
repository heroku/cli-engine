// @flow

import klaw from 'klaw-sync'

export const topics = [
  {name: 'plugins', description: 'manage plugins'},
  {name: 'update', description: 'update CLI'}
]

export const commands = klaw(__dirname, {nodir: true})
  .filter(f => f.path.endsWith('.js'))
  .filter(f => !f.path.endsWith('.test.js'))
  .filter(f => f.path !== __filename)
  .map(f => require(f.path))
