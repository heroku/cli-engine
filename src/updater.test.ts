import * as EventEmitter from 'events'
import * as moment from 'moment'
import * as nock from 'nock'
import * as path from 'path'

import { config, run, skipIfWin32 } from './__test__/run'
import Config from './config'
import * as fs from './file'

jest.mock('cross-spawn')
jest.setTimeout(60000)
const { version } = require(path.join(__dirname, '../example/package.json'))

const { spawn } = require('cross-spawn')
spawn.mockImplementation(() => {
  let spawn = new EventEmitter()
  process.nextTick(() => spawn.emit('close', 0))
  return spawn
})

let api = nock('https://cli-assets.heroku.com')

beforeEach(() => nock.cleanAll())
afterEach(() => {
  delete process.env.CLI_ENGINE_PLATFORM_OVERRIDE
  delete process.env.CLI_ENGINE_ARCH_OVERRIDE
  api.done()
})

skipIfWin32('updates the CLI on unix', async () => {
  process.env.CLI_ENGINE_PLATFORM_OVERRIDE = 'darwin'
  process.env.CLI_ENGINE_ARCH_OVERRIDE = 'x64'
  const config = new Config()
  api
    .get(`/cli-engine-example/channels/stable/darwin-x64`)
    .reply(200, {
      channel: 'stable',
      version: '1.2.3',
      sha256gz: 'd707e56f9f41f05fcb86396b31c1272d6e242e3748212a3ba373a74d13aaff1a',
    })
    .get(`/cli-engine-example/channels/stable/cli-engine-example-v1.2.3-darwin-x64.tar.gz`)
    .replyWithFile(200, path.join(__dirname, `./__test__/fixtures/cli-engine-example-v1.2.3-darwin-x64.tar.gz`))

  await run(['update']).catch(err => {
    if (err.code !== 0) throw err
  })

  expect(spawn.mock.calls[0][0]).toEqual(
    path.join(config.dataDir, '/client/bin', process.platform === 'win32' ? 'cli-engine.cmd' : 'cli-engine'),
  )
  expect(spawn.mock.calls[0][1]).toEqual(['update'])
  expect(spawn.mock.calls[0][2]).toMatchObject({ stdio: 'inherit', env: { CLI_ENGINE_HIDE_UPDATED_MESSAGE: '1' } })

  expect(await fs.readFile(path.join(config.dataDir, 'client/bin/cli-engine'))).toContain('#!/usr/bin/env bash')
})

test('updates the CLI on windows', async () => {
  process.env.CLI_ENGINE_PLATFORM_OVERRIDE = 'win32'
  process.env.CLI_ENGINE_ARCH_OVERRIDE = 'x64'

  const config = new Config({ platform: 'win32', arch: 'x64' })
  api
    .get(`/cli-engine-example/channels/stable/win32-x64`)
    .reply(200, {
      channel: 'stable',
      version: '1.2.3',
      sha256gz: '863802bbf1ebd16d48e0560a8f6cdad476881286bcab73c7633147bfd51600f4',
    })
    .get(`/cli-engine-example/channels/stable/cli-engine-example-v1.2.3-win32-x64.tar.gz`)
    .replyWithFile(200, path.join(__dirname, `./__test__/fixtures/cli-engine-example-v1.2.3-win32-x64.tar.gz`))

  await run(['update']).catch(err => {
    if (err.code !== 0) throw err
  })
  expect(spawn.mock.calls[0][0]).toEqual(
    path.join(config.dataDir, '/client/bin', process.platform === 'win32' ? 'cli-engine.cmd' : 'cli-engine'),
  )
  expect(spawn.mock.calls[0][1]).toEqual(['update'])
  expect(spawn.mock.calls[0][2]).toMatchObject({ stdio: 'inherit', env: { CLI_ENGINE_HIDE_UPDATED_MESSAGE: '1' } })

  expect(await fs.readFile(path.join(config.dataDir, 'client/bin/cli-engine.cmd'))).toEqual(
    `@echo off\n\"%~dp0\\..\\1.2.3\\bin\\cli-engine.cmd\" %*\n`,
  )
})

test('validates the sha', async () => {
  process.env.CLI_ENGINE_PLATFORM_OVERRIDE = 'darwin'
  process.env.CLI_ENGINE_ARCH_OVERRIDE = 'x64'
  const config = new Config()
  api
    .get(`/cli-engine-example/channels/stable/${config.platform}-${config.arch}`)
    .reply(200, { channel: 'stable', version: '1.2.3', sha256gz: 'xxx' })
    .get(`/cli-engine-example/channels/stable/cli-engine-example-v1.2.3-${config.platform}-${config.arch}.tar.gz`)
    .replyWithFile(
      200,
      path.join(__dirname, `./__test__/fixtures/cli-engine-example-v1.2.3-${config.platform}-${config.arch}.tar.gz`),
    )

  await expect(run(['update'])).rejects.toThrowError(
    /SHA mismatch: expected d707e56f9f41f05fcb86396b31c1272d6e242e3748212a3ba373a74d13aaff1a to be xxx/,
  )
})

describe('tidy', () => {
  test.skip('deletes old directories', async () => {
    const oldDate = moment()
      .subtract(48, 'hours')
      .toDate()
    const newDate = moment()
      .subtract(20, 'hours')
      .toDate()

    process.env.CLI_ENGINE_CLI_BINPATH = path.join(process.env.CLI_ENGINE_DATA_DIR!, `/client/${version}/foo`)
    const c = config()

    withFiles({
      [path.join(c.dataDir, '/client/1.0.0')]: { type: 'dir', mtime: oldDate },
      [path.join(c.dataDir, '/client/1.0.1')]: { type: 'dir', mtime: newDate },
      [path.join(c.dataDir, '/client/1.0.2/foo')]: { type: 'file', mtime: oldDate },
      [path.join(c.dataDir, '/client/1.0.3/foo')]: { type: 'file', mtime: newDate },
      [path.join(c.dataDir, '/client/1.0.4/foo')]: { type: 'file', mtime: newDate },
      [path.join(c.dataDir, `/client/${version}/foo`)]: { type: 'file', mtime: oldDate },
      [path.join(c.dataDir, '/client/foo')]: { type: 'file', mtime: oldDate },
      [path.join(c.dataDir, '/client/bar')]: { type: 'file', mtime: newDate },
    })

    fs.utimesSync(path.join(c.dataDir, '/client/1.0.4'), new Date(), oldDate)
    api
      .get(`/cli-engine-example/channels/stable/${c.platform}-${c.arch}`)
      .reply(200, { channel: 'stable', version: c.version })

    const toBeRemoved = [...['1.0.0', '1.0.4', 'foo'].map(p => path.join(c.dataDir, 'client', p))]
    const toRemain = [...['1.0.1', '1.0.2', '1.0.3', version, 'bar'].map(p => path.join(c.dataDir, 'client', p))]

    expect([...toBeRemoved, ...toRemain].map(fs.existsSync)).not.toContain(false)

    await run(['update'])

    expect(toBeRemoved.map(fs.existsSync)).not.toContain(true)
    expect(toRemain.map(fs.existsSync)).not.toContain(false)
  })
})

interface File {
  type: 'file'
  content: string
  mtime?: Date
}

interface Dir {
  type: 'dir'
  mtime?: Date
}

function withFiles(files: { [k: string]: Dir | Partial<File> | string }) {
  for (let p of Object.keys(files)) {
    let file: File | Dir
    if (typeof files[p] === 'string') {
      file = { content: files[p], type: 'file' } as File
    } else {
      file = files[p] as File | Dir
    }
    if (file.type === 'dir') {
      fs.mkdirpSync(p)
    } else {
      fs.outputFileSync(p, file.content || '')
    }
    if (file.mtime) fs.utimesSync(p, new Date(), file.mtime)
  }
}
