/* globals jest test expect */

import Yarn from './yarn'
import Output from 'cli-engine-command/lib/output'
import path from 'path'

test('it adds --non-interactive', async () => {
  let output = new Output({config: {}, mock: true})
  let yarn = new Yarn(output, '/foo/bar')

  let mock = jest.fn()
  mock.mockReturnValue(Promise.resolve(0))
  yarn.fork = mock

  await yarn.exec(['foo', 'bar'])

  let yarnjs = path.resolve(yarn.bin)

  expect(mock.mock.calls).toEqual([[yarnjs, ['foo', 'bar', '--non-interactive'], {
    'cwd': '/foo/bar',
    'stdio': [
      null,
      null,
      null,
      'ipc'
    ]
  }]])
})
