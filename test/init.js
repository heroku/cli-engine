import '../src/fs'
import {defaultConfig, buildConfig} from 'cli-engine-config'
import nock from 'nock'
import path from 'path'

jest.unmock('fs-extra')

process.setMaxListeners(0)
global.columns = 80
global.testing = true
global.exampleConfig = buildConfig({root: path.join(__dirname, '..', 'example')})
global.testFooConfig = buildConfig({root: path.join(__dirname, 'roots', 'test-foo')})
global.joeDevConfig = buildConfig({root: path.join(__dirname, 'roots', 'joe-dev')})
global.yarnCacheDir = path.join(defaultConfig.cacheDir, 'yarn')
nock.disableNetConnect()
