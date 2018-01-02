import cli from 'cli-ux'
import * as nock from 'nock'
import * as path from 'path'
import * as semver from 'semver'

import { run as runCLI } from '../cli'
import Config from '../config'

const debug = require('debug')

const root = path.join(__dirname, '../../example')
const { version } = require(path.join(root, 'package.json'))

const handleErr = (err: Error) => require('debug')('test')(err)
cli.on('warn', handleErr)
cli.on('error', handleErr)

export async function run(argv: string[] = []) {
  // mock some things
  nock('https://cli-assets.heroku.com')
    .get('/cli-engine-example/channels/stable/version')
    .reply(200, { channel: 'stable', version })

  cli.config.mock = true

  // run CLI
  await runCLI(['node', 'run', ...argv], { root })

  // show debug output
  const d = debug(`test:${argv[0]}`)
  const stdout = cli.stdout.output
  const stderr = cli.stderr.output
  if (stdout) d(`stdout: ${stdout}`)
  if (stderr) d(`stdout: ${stderr}`)

  return { stdout, stderr }
}

export function config() {
  return new Config({ root })
}

export const skipIfWin32 = process.platform === 'win32' ? test.skip : test
export const skipIfNode6 = semver.lt(process.versions.node, '7.0.0') ? test.skip : test
