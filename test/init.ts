import '../src/fs'
import { defaultConfig, buildConfig } from 'cli-engine-config'
import * as nock from 'nock'
import * as path from 'path'
import { cli } from 'cli-ux'

process.setMaxListeners(0)

let g: any = global
g.columns = 80
g.testing = true
g.exampleConfig = buildConfig({ root: path.join(__dirname, '..', 'example') })
g.testFooConfig = buildConfig({ root: path.join(__dirname, 'roots', 'test-foo') })
g.yarnCacheDir = path.join(defaultConfig.cacheDir, 'yarn')
nock.disableNetConnect()

beforeEach(() => {
  cli.config.mock = true
})
