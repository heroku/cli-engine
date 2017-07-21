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

// bin 'cli-engine'
//   - cli namespaces undefined || null X
//     - installs undefined namespaced X
//       - user plugin undefined  X
//       - linked plugin undefined  X
//     - does not install defined namespaced X
//       - user plugin  X
//       - linked plugin  ?? << need a namespaced plugin
//   - cli namespaces ['heroku'] X
//     - installs permitted namespaced X
//       - user plugin 'herkou' X
//       - linked plugin 'herkou' ?? << need a namespaced plugin
//     - does not install undefined namespaced X
//       - user plugin  X
//       - linked plugin  X
//     - does not install unpermitted namespaced X
//       - user plugin  X
//       - linked plugin  ?? << need a namespaced plugin

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

describe.skip('CLI bin \'cli-engine\'', () => {
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
    })

    describe('does not install unpermitted namespaced', () => {
      test('user plugin heroku-debug with namespace \'heroku\'', async () => {
        let msg
        try {
          await run('plugins:install', 'heroku-debug')
        } catch (err) {
          msg = err.message
        } finally {
          expect(msg).toEqual('Plugin\'s namespace not included in permitted namespaces')
        }
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

    describe('does not install undefined namespaced', () => {
      test('user plugin heroku-debug', async () => {
        let msg
        try {
          await run('plugins:install', 'heroku-debug@4.0.0')
        } catch (err) {
          msg = err.message
        } finally {
          expect(msg).toEqual('Plugin\'s namespace not included in permitted namespaces')
        }
      })

      test('linked plugin cli-engine-example-plugin', async () => {
        let msg
        try {
          await run('plugins:link', './example-plugin')
        } catch (err) {
          msg = err.message
        } finally {
          expect(msg).toEqual('Plugin\'s namespace not included in permitted namespaces')
        }
      })
    })

    describe('does not install unpermitted namespaced', () => {
      test('user plugin heroku-debug with namespace \'cowabunga\'', async () => {
        let msg
        try {
          await run('plugins:install', 'heroku-debug@5.0.3')
        } catch (err) {
          msg = err.message
        } finally {
          expect(msg).toEqual('Plugin\'s namespace not included in permitted namespaces')
        }
      })
    })
  })
})
