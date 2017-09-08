// @flow

import {Hooks} from './hooks'
import {buildConfig} from 'cli-engine-config'

let init = (options = {}) => {
  process.env.RAN_HOOK = '0'
  let config = buildConfig(options)
  return new Hooks({config})
}

test('does not error when no hooks', async () => {
  let hooks = init()
  await hooks.run('prerun')
})

test('fires a hook', async () => {
  let hooks = init({
    root: process.cwd(),
    hooks: {
      prerun: [
        'test/fixtures/hooks/prerun.js'
      ]
    }
  })
  await hooks.run('prerun')
  expect(process.env.RAN_HOOK).toEqual('1')
})
