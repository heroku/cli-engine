import * as path from 'path'

import Config from './config'
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

test('fires a legacy hook', async () => {
  let hooks = init({
    root: path.join(__dirname, '..'),
    pjson: {
      'cli-engine': {
        hooks: {
          init: ['src/__test__/fixtures/hooks/legacy.ts'],
        },
      },
    },
  })
  await hooks.run('init')
  expect(process.env.RAN_HOOK).toEqual('1')
})

test('fires a hook', async () => {
  let hooks = init({
    root: path.join(__dirname, '..'),
    pjson: {
      'cli-engine': {
        hooks: {
          prerun: ['src/__test__/fixtures/hooks/prerun.ts'],
        },
      },
    },
  })
  await hooks.run('prerun', { argv: ['1', '2'], Command: {} as any })
  expect(process.env.PRERUN_HOOK_ARGS).toEqual('1 2')
})
