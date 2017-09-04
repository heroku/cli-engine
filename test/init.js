import '../src/fs'
import nock from 'nock'

process.setMaxListeners(0)
global.columns = 80
global.testing = true
global.yarnCacheDir = false
nock.disableNetConnect()
