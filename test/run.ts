import cli from 'cli-ux'

import {run as runCLI} from '../src/cli'

export async function run (argv: string[] = []) {
  await runCLI(['node', 'run', ...argv])
  return {
    stdout: cli.stdout.output,
    stderr: cli.stderr.output,
  }
}
