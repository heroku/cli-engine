// @flow

import path from 'path'
import {buildConfig, type RunReturn} from 'cli-engine-config'
import CLI from '../src/cli'

const envs = {
  example: buildConfig({mock: true, root: path.join(__dirname, '..', 'example')}),
  'test-foo': buildConfig({mock: true, root: path.join(__dirname, 'roots', 'test-foo')})
}

type RunOptions = {
  code?: number
}

async function run (env: string, argv: string[] = [], options: RunOptions = {}): Promise<RunReturn> {
  let cli = new CLI({
    config: {
      ...envs[env],
      argv: [envs[env].bin].concat(argv)
    }
  })
  try {
    await cli.run()
    if (options.code) throw new Error(`expected code to be ${options.code} but received 0`)
  } catch (err) {
    if (options.code && err.code !== options.code) throw err
    return {stderr: err.stderr, stdout: err.stdout}
  }
  return cli.cmd
}

export function example (argv: string[] = [], options: RunOptions = {}) {
  return run('example', argv, options)
}

export function foo (argv: string[] = [], options: RunOptions = {}) {
  return run('test-foo', argv, options)
}
