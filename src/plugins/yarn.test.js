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

  let call = mock.mock.calls[0]
  expect(call[0]).toEqual(yarnjs)
  expect(call[1][0]).toEqual('foo')
  expect(call[1][1]).toEqual('bar')
  expect(call[1][2]).toEqual('--non-interactive')
  expect(call[2]).toEqual({
    'cwd': '/foo/bar',
    'stdio': [
      null,
      null,
      null,
      'ipc'
    ]
  })
})
