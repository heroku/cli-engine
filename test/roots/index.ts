import { run } from '../../src/cli'
import { cli } from 'cli-ux'

export interface IRootRun {
  code: number
  stdout: string
  stderr: string
}

export async function example(argv: string[]): Promise<IRootRun> {
  let code = 0
  argv = ['cli-engine', ...argv]
  await run({ config: { argv } })
  return {
    stdout: cli.stdout.output,
    stderr: cli.stderr.output,
    code,
  }
}
