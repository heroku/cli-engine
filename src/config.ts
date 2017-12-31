import { Config as Base } from '@cli-engine/config'

export { ConfigOptions } from '@cli-engine/config'
import { Plugins } from './plugins'

export class Config extends Base {
  plugins: Plugins

  get platform() {
    return (this.scopedEnvVar('PLATFORM') as any) || super.platform
  }
  get arch() {
    return (this.scopedEnvVar('ARCH') as any) || super.arch
  }

  get dataDir() {
    return this.scopedEnvVar('DATA_DIR') || super.dataDir
  }
  get cacheDir() {
    return this.scopedEnvVar('CACHE_DIR') || super.cacheDir
  }
}
export default Config
