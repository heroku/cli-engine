import '../src/fs'
import nock from 'nock'

global.columns = 80
global.testing = true
global.yarnCacheDir = false
nock.disableNetConnect()
