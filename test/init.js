import '../src/fs'
import nock from 'nock'

global.testing = true
nock.disableNetConnect()
