import * as fs from 'fs-extra'
import * as nock from 'nock'
import * as path from 'path'

import Config from '../config'

process.env.CLI_ENGINE_DATA_DIR = path.join(__dirname, '../../tmp/data')
process.env.CLI_ENGINE_CACHE_DIR = path.join(__dirname, '../../tmp/cache')

require('events').defaultMaxListeners = 100

let g: any = global
g.columns = 80
g.testing = true
nock.disableNetConnect()

const config = new Config({ root: path.join(__dirname, '..', '..') })

fs.removeSync(config.dataDir)
