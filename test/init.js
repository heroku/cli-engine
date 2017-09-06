import '../src/fs'
import {defaultConfig} from 'cli-engine-config'
import nock from 'nock'
import path from 'path'

process.setMaxListeners(0)
global.columns = 80
global.testing = true
global.yarnCacheDir = path.join(defaultConfig.cacheDir, 'yarn')
console.log(global.yarnCacheDir)
nock.disableNetConnect()
