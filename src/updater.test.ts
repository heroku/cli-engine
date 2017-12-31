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
      sha256gz: '83ee9ce76e691208f39716d74a8944bfcc6ba5358ec23d43034d13727524aee2',
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
      sha256gz: 'e1daa2045c1569fa798a30b90a2c3f06ecd50bc6bf0b9c24d6b47f5ef63c57bf',
    })
    .get(`/cli-engine-example/channels/stable/cli-engine-example-v1.2.3-win32-x64.tar.gz`)
    .replyWithFile(200, path.join(__dirname, `./__test__/fixtures/cli-engine-example-v1.2.3-win32-x64.tar.gz`))
    .get(`/cli-engine-example/channels/stable/version`)
    .reply(200, { channel: 'stable', version: '1.2.3' })

  await run(['update'])

  expect(await fs.readFile(path.join(config.dataDir, 'client/bin/cli-engine.cmd'))).toEqual(
    `@echo off\n\"%~dp0\\..\\cli-engine-example-v1.2.3-win32-x64\\bin\\cli-engine.cmd\" %*\n`,
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
    /SHA mismatch: expected 83ee9ce76e691208f39716d74a8944bfcc6ba5358ec23d43034d13727524aee2 to be xxx/,
  )
})
