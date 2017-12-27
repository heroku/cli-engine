import { Config } from '@cli-engine/config'
import { cli } from 'cli-ux'
import * as fs from 'fs-extra'
import * as nock from 'nock'
import * as path from 'path'

process.setMaxListeners(0)

let g: any = global
g.columns = 80
g.testing = true
nock.disableNetConnect()

const config = new Config({ root: path.join(__dirname, '..', '..') })

fs.removeSync(config.dataDir)
fs.removeSync(config.cacheDir)
fs.removeSync(config.configDir)

beforeEach(() => {
  cli.config.mock = true
})
