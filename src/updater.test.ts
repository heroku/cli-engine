import * as EventEmitter from 'events'
import * as moment from 'moment'
import * as nock from 'nock'
import * as path from 'path'

import { config, run, skipIfWin32 } from './__test__/run'
import Config from './config'
import * as fs from './file'

jest.mock('cross-spawn')

const { spawn } = require('cross-spawn')
spawn.mockImplementation(() => {
  let spawn = new EventEmitter()
  process.nextTick(() => spawn.emit('close', 0))
  return spawn
})

let api = nock('https://cli-assets.heroku.com')

beforeEach(() => nock.cleanAll())
afterEach(() => {
  delete process.env.CLI_ENGINE_PLATFORM
  delete process.env.CLI_ENGINE_ARCH
  api.done()
})

skipIfWin32('updates the CLI on unix', async () => {
  process.env.CLI_ENGINE_PLATFORM = 'darwin'
  process.env.CLI_ENGINE_ARCH = 'x64'
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

  expect(spawn).toBeCalledWith('cli-engine', ['update'], { stdio: 'inherit' })

  expect(await fs.readFile(path.join(config.dataDir, 'client/bin/cli-engine'))).toContain('#!/usr/bin/env bash')
})

test('updates the CLI on windows', async () => {
  process.env.CLI_ENGINE_PLATFORM = 'win32'
  process.env.CLI_ENGINE_ARCH = 'x64'

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
  expect(spawn).toBeCalledWith('cli-engine', ['update'], { stdio: 'inherit' })

  expect(await fs.readFile(path.join(config.dataDir, 'client/bin/cli-engine.cmd'))).toEqual(
    `@echo off\n\"%~dp0\\..\\1.2.3\\bin\\cli-engine.cmd\" %*\n`,
  )
})

test('validates the sha', async () => {
  process.env.CLI_ENGINE_PLATFORM = 'darwin'
  process.env.CLI_ENGINE_ARCH = 'x64'
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
  test('deletes old directories', async () => {
    const oldDate = moment()
      .subtract(48, 'hours')
      .toDate()
    const newDate = moment()
      .subtract(20, 'hours')
      .toDate()

    const c = config()
    const oldFiles = [
      /* 0 keep */ '/client/1.0.0/subdir/old1',
      /* 1 keep */ '/client/1.0.0/subdir/old2',
      /* 2 keep */ '/client/1.0.1/old1',
      /* 3 keep */ '/client/1.0.1/old2',
      /* 4 keep */ '/old',
      /* 5 keep */ '/client/bin/old',
      /* 6 keep */ `/client/${c.version}/old`,
      /* 7 rm */ '/client/old',
      /* 8 rm */ '/client/1.0.2/old1',
      /* 9 rm */ '/client/1.0.2/old2',
    ].map(p => path.join(c.dataDir, p))
    const newFiles = [/* 0 */ '/client/1.0.0/subdir/new', /* 1 */ '/client/1.0.1/new', /* 2 */ '/client/new'].map(p =>
      path.join(c.dataDir, p),
    )

    withFiles(oldFiles.reduce((files, f) => ({ ...files, [f]: { mtime: oldDate } }), {}))
    withFiles(newFiles.reduce((files, f) => ({ ...files, [f]: { mtime: newDate } }), {}))

    api
      .get(`/cli-engine-example/channels/stable/${c.platform}-${c.arch}`)
      .reply(200, { channel: 'stable', version: c.version })

    const toBeRemoved = [...['/client/1.0.2', '/client/old'].map(p => path.join(c.dataDir, p))]
    expect(toBeRemoved.map(fs.existsSync)).not.toContain(false)

    await run(['update'])

    expect(toBeRemoved.map(fs.existsSync)).not.toContain(true)

    expect([...newFiles, ...oldFiles.slice(0, 7)].map(fs.existsSync)).not.toContain(false)
  })
})

interface File {
  content?: string
  mtime?: Date
}

function withFiles(files: { [k: string]: File | string }) {
  for (let p of Object.keys(files)) {
    let file = typeof files[p] === 'string' ? ({ content: files[p] } as File) : (files[p] as File)
    fs.outputFileSync(p, file.content || '')
    if (file.mtime) fs.utimesSync(p, new Date(), file.mtime)
  }
}
