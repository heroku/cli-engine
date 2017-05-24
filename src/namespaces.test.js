// @flow

import CLI from './cli'
import {tmpDirs} from '../test/helpers'

jasmine.DEFAULT_TIMEOUT_INTERVAL = 90000

function runClosure (namespaces: ?(?string)[]) {
  let tmpDir = tmpDirs({namespaces})
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

describe('CLI bin \'cli-engine\'', () => {
  describe('CLI namespaces undefined OR null', () => {
    let run
    beforeEach(() => {
      run = runClosure()
    })

    afterEach(() => {
      run.clean()
    })

    describe('installs undefined namespaced', () => {
      test('user plugin heroku-debug', async () => {
        await run('plugins:install', 'heroku-debug@4.0.0')
        await run('debug')
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

    describe('does not install namespaced', () => {
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
    beforeEach(() => {
      run = runClosure(['heroku'])
    })

    afterEach(() => {
      run.clean()
    })

    describe('installs permitted namespaced', () => {
      test('user plugin heroku-debug with namespace \'heroku\'', async () => {
        await run('plugins:install', 'heroku-debug@5.0.2')
        await run('heroku:debug')
        try {
          await run('debug')
        } catch (err) {
          expect(err.code).toEqual(127)
        }
        await run('help', 'heroku:debug')
        try {
          await run('help', 'debug')
        } catch (err) {
          expect(err.message).toEqual('command debug not found')
        }
        let help = await run('help', 'heroku')
        expect(help.out.stdout.output).toMatch(/^ +heroku:debug # CLI debugging tools$/m)
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

    describe('does not install namespaced', () => {
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
