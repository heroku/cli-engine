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
  let dataDir = tmp.dirSync().name
  let cacheDir = tmp.dirSync().name

  fs.mkdirs(path.join(dataDir, 'plugins'))

  let root = path.join(testDir, 'roots', 'test-foo')
  let pjson = fs.readJSONSync(path.join(root, 'package.json'))
  let config = buildConfig(Object.assign({root, cacheDir, dataDir, pjson}, cfg))
  let output = new Output({config, mock: true})
  let plugins = new Plugins(output)

  let clean = function () {
    fs.removeSync(cacheDir)
    fs.removeSync(dataDir)
  }

  return { clean, plugins, output, config, cacheDir, dataDir }
}
