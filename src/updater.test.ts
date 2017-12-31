// import * as execa from 'execa'
import * as nock from 'nock'
import * as path from 'path'

import { run, skipIfWin32 } from './__test__/run'
import Config from './config'
import * as fs from './file'

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
    .get(`/cli-engine-example/channels/stable/version`)
    .reply(200, { channel: 'stable', version: '1.2.3' })

  await run(['update'])

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
    .get(`/cli-engine-example/channels/stable/version`)
    .reply(200, { channel: 'stable', version: '1.2.3' })

  await run(['update'])

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
