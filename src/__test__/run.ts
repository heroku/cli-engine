import cli from 'cli-ux'
import * as path from 'path'

import { run as runCLI } from '../cli'

export async function run(argv: string[] = []) {
  cli.config.mock = true
  const root = path.join(__dirname, '../../example')
  await runCLI(['node', 'run', ...argv], { root })
  return {
    stdout: cli.stdout.output,
    stderr: cli.stderr.output,
  }
}
