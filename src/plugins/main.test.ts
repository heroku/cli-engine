import { run } from '../__test__/run'

test('run help jobs:start', async () => {
  const { stdout } = await run(['help', 'jobs:start'])
  expect(stdout).toEqual(`Usage: cli-engine jobs:start JOB

this is the command description

Aliases:
  $ cli-engine start
  $ cli-engine newjob

this is some example help text

`)
})

test('run jobs:start', async () => {
  const { stdout } = await run(['jobs:start', 'myjob'])
  expect(stdout).toEqual('starting job: myjob... done\n')
})
