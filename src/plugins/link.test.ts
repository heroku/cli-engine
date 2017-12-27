import * as fs from 'fs-extra'
import * as path from 'path'

import { run } from '../__test__/run'

jest.setTimeout(120000)

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
    existingFiles.push({ path: existingCommand, body: fs.readFileSync(existingCommand) })

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
    existingFiles.push({ path: pjsonPath, body: fs.readFileSync(pjsonPath) })
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
    for (let f of newFiles) fs.removeSync(f)
    for (let f of existingFiles) fs.writeFileSync(f.path, f.body)
  }
})
