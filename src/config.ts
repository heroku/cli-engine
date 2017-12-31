import { Config as Base } from '@cli-engine/config'

export { ConfigOptions } from '@cli-engine/config'
import { Plugins } from './plugins'

export class Config extends Base {
  plugins: Plugins

  get dataDir() {
    return this.scopedEnvVar('DATA_DIR') || super.dataDir
  }
  get cacheDir() {
    return this.scopedEnvVar('CACHE_DIR') || super.cacheDir
  }
}
export default Config
