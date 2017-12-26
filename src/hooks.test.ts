import { Config } from '@cli-engine/config'
import * as path from 'path'
import { Hooks } from './hooks'

let init = (options = {}) => {
  process.env.RAN_HOOK = '0'
  let config = new Config(options)
  return new Hooks(config)
}

test('does not error when no hooks', async () => {
  let hooks = init()
  await hooks.run('init')
})

test('fires a hook', async () => {
  let hooks = init({
    root: path.join(__dirname, '..'),
    hooks: {
      init: ['test/fixtures/hooks/prerun.js'],
    },
  })
  await hooks.run('init')
  expect(process.env.RAN_HOOK).toEqual('1')
})
