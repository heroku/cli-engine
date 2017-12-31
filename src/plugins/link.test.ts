import * as path from 'path'

import { run } from '../__test__/run'
import Config from '../config'
import * as fs from '../file'

jest.setTimeout(400000)

test('links example-plugin', async () => {
  let newFiles = []
  let existingFiles = []
  try {
    await run(['plugins:link', './plugins/example-plugin', '--force'])

    // check for plugin
    expect((await run(['plugins'])).stdout).toMatch(/cli-engine-example-plugin .* \(link\)/)

    // get plugin's help
    expect((await run(['help'])).stdout).toMatch(/cli.*cli-engine example plugin/)
    expect((await run(['help', 'cli:test'])).stdout).toContain('this is an example command for cli-engine')

    // run command
    expect((await run(['cli:test'])).stdout).toEqual('ran cli:test\n')

    // add new command
    const newCommandPath = path.join('plugins', 'example-plugin', 'src', 'commands', 'foo', 'bar.ts')
    newFiles.push(newCommandPath)
    await fs.outputFile(
      newCommandPath,
      `
import { Command } from '@cli-engine/command'
import { cli } from 'cli-ux'

export default class extends Command {
  static description = 'this is a new command description'
  async run() { cli.log('ran the command') }
}`,
    )
    // run new command
    expect((await run(['help', 'foo:bar'])).stdout).toContain('this is a new command description')
    expect((await run(['foo:bar'])).stdout).toEqual('ran the command\n')

    // edit old command
    let existingCommand = path.join('plugins', 'example-plugin', 'src', 'commands', 'cli', 'test.ts')
    existingFiles.push({ path: existingCommand, body: await fs.readFile(existingCommand) })

    await fs.outputFile(
      existingCommand,
      `
import { Command } from '@cli-engine/command'
import { cli } from 'cli-ux'

export default class extends Command {
  static description = 'new cli:test desc'
  async run() { cli.log('ran the new cli:test') }
}`,
    )
    // add topic
    let pjsonPath = path.join('plugins', 'example-plugin', 'package.json')
    existingFiles.push({ path: pjsonPath, body: await fs.readFile(pjsonPath) })
    let pjson = await fs.readJSON(pjsonPath)
    pjson['cli-engine'].topics.foo = { description: 'this is my new topic desc' }
    await fs.outputJSON(path.join('plugins', 'example-plugin', 'package.json'), pjson, { spaces: 2 })
    jest.resetModules()
    // run new command
    expect((await run(['help'])).stdout).toMatch(/foo +this is my new topic desc/)
    expect((await run(['help', 'cli:test'])).stdout).toContain('new cli:test desc')
    expect((await run(['cli:test'])).stdout).toEqual('ran the new cli:test\n')

    // unlink plugin
    await run(['plugins:unlink', './plugins/example-plugin'])

    // ensure plugin is gone
    expect((await run(['plugins'])).stdout).not.toContain('cli-engine-example-plugin')

    // ensure plugin help is gone
    expect((await run(['help'])).stdout).not.toContain('foo')
    expect((await run(['help', 'cli:test'])).stdout).toContain('this is an example command for cli-engine')
    await expect(run(['help', 'foo:bar'])).rejects.toThrow(/Exited with code: 127/)
  } finally {
    for (let f of newFiles) await fs.remove(f)
    for (let f of existingFiles) await fs.outputFile(f.path, f.body)
  }
})

const skipIfWin32 = process.platform === 'win32' ? test.skip : test

describe('migrate', () => {
  skipIfWin32('migrates heroku-kafka-jsplugin', async () => {
    const config = new Config()
    const legacyPath = path.join(config.dataDir, 'linked_plugins.json')
    await fs.outputJSON(legacyPath, {
      version: '1',
      updated_at: '2017-12-28T00:26:11.624Z',
      plugins: [path.join(__dirname, '../../plugins/heroku-kafka-jsplugin')],
    })
    expect((await run(['help', 'kafka'])).stdout).toMatch(
      /kafka:consumer-groups \[CLUSTER\] +lists available Kafka consumer groups/,
    )
    await expect(fs.exists(legacyPath)).resolves.toBeFalsy()
  })

  test('migrates heroku-apps', async () => {
    const config = new Config()
    const legacyPath = path.join(config.dataDir, 'linked_plugins.json')
    await fs.outputJSON(legacyPath, {
      version: '1',
      updated_at: '2017-12-28T00:26:11.624Z',
      plugins: [path.join(__dirname, '../../plugins/heroku-apps')],
    })
    expect((await run(['help', 'config:get'])).stdout).toMatch(/Usage: cli-engine config:get KEY \[flags\]/)
    await expect(fs.exists(legacyPath)).resolves.toBeFalsy()
  })
})
