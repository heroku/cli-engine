import { Config as Base } from '@cli-engine/config'

export { ConfigOptions } from '@cli-engine/config'

export class Config extends Base {
  get dataDir() {
    return this.scopedEnvVar('DATA_DIR') || super.dataDir
  }
  get cacheDir() {
    return this.scopedEnvVar('CACHE_DIR') || super.cacheDir
  }
}
export default Config
