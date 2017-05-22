// @flow

import path from 'path'
import tmp from 'tmp'
import fs from 'fs-extra'

import Output from 'cli-engine-command/lib/output'
import Plugins from '../src/plugins'
import Yarn from '../src/plugins/yarn'

import {buildConfig} from 'cli-engine-config'

export function tmpDirs (cfg: any = {}) {
  Yarn.extraOpts = ['--prefer-offline']

  let testDir = path.join(path.dirname(__filename))

  let tmpDir = path.resolve(path.join(__dirname, '..', 'tmp'))
  fs.mkdirsSync(tmpDir)

  let template = path.join(tmpDir, 'tmp-XXXXXX')

  let dataDir = tmp.dirSync({template}).name
  let cacheDir = tmp.dirSync({template}).name

  fs.mkdirs(path.join(dataDir, 'plugins'))

  let root = path.join(testDir, 'roots', 'test-foo')
  let pjson = fs.readJSONSync(path.join(root, 'package.json'))
  let config = buildConfig(Object.assign({root, cacheDir, dataDir, pjson}, cfg))
  let output = new Output({config, mock: true})
  let plugins = new Plugins(output)

  let clean = function () {
    try {
      fs.removeSync(cacheDir)
      fs.removeSync(dataDir)
    } catch (err) {
      console.warn('Unable to clean up tmp - ignore on appveyor')
    }
  }

  return { clean, plugins, output, config, cacheDir, dataDir }
}
