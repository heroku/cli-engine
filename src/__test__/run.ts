import cli from 'cli-ux'
import * as path from 'path'

import { run as runCLI } from '../cli'

export async function run(argv: string[] = []) {
  await runCLI(['node', 'run', ...argv], {
    root: path.join(__dirname, '..', '..', 'example'),
  })
  return {
    stdout: cli.stdout.output,
    stderr: cli.stderr.output,
  }
}
