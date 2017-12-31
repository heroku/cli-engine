import cli from 'cli-ux'
import * as nock from 'nock'
import * as path from 'path'

import { run as runCLI } from '../cli'

export async function run(argv: string[] = []) {
  nock('https://cli-assets.heroku.com:443')
    .get('/cli-engine-example/channels/stable/version')
    .reply(200, { channel: 'stable', version: '9.9.9' })
  cli.config.mock = true
  const root = path.join(__dirname, '../../example')
  await runCLI(['node', 'run', ...argv], { root })
  return {
    stdout: cli.stdout.output,
    stderr: cli.stderr.output,
  }
}
