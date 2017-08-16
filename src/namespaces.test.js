// @flow

import CLI from './cli'
import {tmpDirs} from '../test/helpers'

jest.unmock('fs-extra')

jasmine.DEFAULT_TIMEOUT_INTERVAL = 90000

async function runClosure (namespaces: ?(?string)[]) {
  let tmpDir = await tmpDirs({namespaces})
  let fn = async function (...argv: string[]) {
    let cli = new CLI({argv: ['cli'].concat(argv), mock: true, config: tmpDir.config})
    try {
      await cli.run()
    } catch (err) {
      if (err.code !== 0) throw err
    }
    return cli.cmd
  }
  fn.clean = tmpDir.clean
  return fn
}

let dir = console.dir
let mockDir

beforeEach(() => {
  // flow$ignore
  console.dir = mockDir = jest.fn()
})

afterEach(() => {
  // flow$ignore
  console.dir = dir
})

describe('CLI bin \'cli-engine\'', () => {
  describe('CLI namespaces undefined OR null', () => {
    let run
    beforeEach(async () => {
      run = await runClosure()
    })

    afterEach(() => {
      run.clean()
    })

    describe('installs undefined namespaced', () => {
      test('user plugin heroku-debug', async () => {
        await run('plugins:install', 'heroku-debug@4.0.0')
        await run('debug')
        expect(mockDir.mock.calls[0][0]).toMatchObject({context: {apiHost: 'api.heroku.com'}})
        await run('help', 'debug')
        await run('plugins:uninstall', 'heroku-debug')
      })

      test('linked plugin cli-engine-example-plugin', async () => {
        await run('plugins:link', './example-plugin')
        await run('cli:test')
        await run('help', 'cli')
        await run('plugins:uninstall', 'cli-engine-example-plugin')
      })

      test('user plugin heroku-debug with namespace \'heroku\' into root', async () => {
        expect.assertions(1)
        await run('plugins:install', 'heroku-debug@5.0.2')
        await run('debug')
        await run('help', 'debug')
        try {
          await run('help', 'heroku:debug')
        } catch (err) {
          expect(err.message).toEqual('command heroku:debug not found')
        }
        await run('plugins:uninstall', 'heroku-debug')
      })
    })
  })

  describe('CLI namespaces [\'heroku\']', () => {
    let run
    beforeEach(async () => {
      run = await runClosure(['heroku'])
    })

    afterEach(() => {
      run.clean()
    })

    describe('installs permitted namespaced', () => {
      test('user plugin heroku-debug with namespace \'heroku\'', async () => {
        expect.assertions(5)
        await run('plugins:install', 'heroku-debug@5.0.2')
        await run('heroku:debug')
        let namspaceHelp = await run('help', 'heroku')
        expect(namspaceHelp.out.stdout.output).toMatch(/^ +heroku:debug +CLI debugging tools$/m)
        let topicCommandHelp = await run('help', 'heroku:debug')
        // since heroku:debug is a topic-command
        // expect both command help and topic help
        expect(topicCommandHelp.out.stdout.output).toMatch(/^Usage: cli-engine heroku:debug(\n|\s)+Outputs debugging info$/m)
        expect(topicCommandHelp.out.stdout.output).toMatch(/cli-engine heroku:debug commands: \(get help with cli-engine help heroku:debug:COMMAND\)(\n\s)+heroku:debug +Outputs debugging info$/m)
        // make sure it didn't install w/o a namespace
        try {
          await run('debug')
        } catch (err) {
          if (!err.code) throw err
          expect(err.code).toEqual(127)
        }
        try {
          await run('help', 'debug')
        } catch (err) {
          expect(err.message).toEqual('command debug not found')
        }
        await run('plugins:uninstall', 'heroku-debug')
      })
    })
  })
})
