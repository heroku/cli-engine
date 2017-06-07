import '../src/fs'
import nock from 'nock'

global.testing = true
global.yarnCacheDir = false
nock.disableNetConnect()
