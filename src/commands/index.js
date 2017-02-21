// @flow

import klaw from 'klaw-sync'
import config from '../config'

export const topics = [
  {name: 'plugins', description: `manage ${config.name} plugins`}
]

export const commands = klaw(__dirname, {nodir: true})
  .filter(f => f.path.endsWith('.js'))
  .filter(f => !f.path.endsWith('.test.js'))
  .map(f => require(f.path))
