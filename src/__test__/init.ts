import * as fs from 'fs-extra'
import * as nock from 'nock'

require('events').defaultMaxListeners = 100

let g: any = global
g.columns = 80
g.testing = true
nock.disableNetConnect()

fs.removeSync(process.env.CLI_ENGINE_DATA_DIR!)
