import { Config } from '@cli-engine/config'
import { cli } from 'cli-ux'
import * as nock from 'nock'
import * as path from 'path'
import '../src/fs'

process.setMaxListeners(0)

let g: any = global
g.columns = 80
g.testing = true
g.exampleConfig = new Config({ root: path.join(__dirname, '..', 'example') })
g.testFooConfig = new Config({ root: path.join(__dirname, 'roots', 'test-foo') })
g.yarnCacheDir = path.join(new Config().cacheDir, 'yarn')
nock.disableNetConnect()

beforeEach(() => {
  cli.config.mock = true
})
