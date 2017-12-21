import { buildConfig } from 'cli-engine-config'
import * as path from 'path'
import { Hooks } from './hooks'

let init = (options = {}) => {
  process.env.RAN_HOOK = '0'
  let config = buildConfig(options)
  return new Hooks(config)
}

test('does not error when no hooks', async () => {
  let hooks = init()
  await hooks.run('init')
})

test('fires a hook', async () => {
  let hooks = init({
    hooks: {
      init: ['test/fixtures/hooks/prerun.js'],
    },
    root: path.join(__dirname, '..'),
  })
  await hooks.run('init')
  expect(process.env.RAN_HOOK).toEqual('1')
})
