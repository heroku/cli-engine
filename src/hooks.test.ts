import {Hooks} from './hooks'
import {buildConfig} from 'cli-engine-config'
import * as path from 'path'

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
    root: path.join(__dirname, '..'),
    hooks: {
      prerun: [
        'test/fixtures/hooks/prerun.js'
      ]
    }
  })
  await hooks.run('prerun')
  expect(process.env.RAN_HOOK).toEqual('1')
})
