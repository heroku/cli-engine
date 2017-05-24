import {tmpDirs} from '../../test/helpers'
import CLI from '../cli'

const path = require('path')
const fs = require('fs-extra')

jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000

let tmpDir
beforeEach(() => {
  tmpDir = tmpDirs()
})

afterEach(() => {
  tmpDir.clean()
})

test('plugins should be reloaded if migrated', async () => {
  let dataDir = tmpDir.dataDir

  let src = path.join(__dirname, '..', '..', 'test', 'links', 'test-migrator')
  fs.mkdirsSync(path.join(dataDir, 'plugins'))

  let dst = path.join(dataDir, 'plugins', 'node_modules', 'test-migrator')
  fs.copySync(src, dst)

  let json = [{name: 'test-migrator'}]
  fs.writeJSONSync(path.join(dataDir, 'plugins', 'plugins.json'), json)

  let cli = new CLI({argv: ['cli', 'migrator'], mock: true, config: tmpDir.config})
  try {
    await cli.run()
  } catch (err) {
    if (err.code !== 0) throw err
  }
})
