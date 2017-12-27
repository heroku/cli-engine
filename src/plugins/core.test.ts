import { run } from '../__test__/run'

test('run help cli:test', async () => {
  const { stdout } = await run(['help', 'cli:test'])
  expect(stdout).toEqual(`Usage: cli-engine cli:test

this is an example command for cli-engine

it just prints some output

Example:

 $ cli-engine-example cli:test
 ran cli:test

`)
})

test('run cli:test', async () => {
  const { stdout } = await run(['cli:test'])
  expect(stdout).toEqual('ran cli:test\n')
})
