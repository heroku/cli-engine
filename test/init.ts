import { buildConfig } from 'cli-engine-config'
import { cli } from 'cli-ux'
import * as nock from 'nock'
import * as path from 'path'
import '../src/fs'

process.setMaxListeners(0)

let g: any = global
g.columns = 80
g.testing = true
g.exampleConfig = buildConfig({ root: path.join(__dirname, '..', 'example') })
g.testFooConfig = buildConfig({ root: path.join(__dirname, 'roots', 'test-foo') })
g.yarnCacheDir = path.join(buildConfig().cacheDir, 'yarn')
nock.disableNetConnect()

beforeEach(() => {
  cli.config.mock = true
})
