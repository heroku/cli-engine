import { Config as Base } from '@cli-engine/config'

export { ConfigOptions } from '@cli-engine/config'
import { Plugins } from './plugins'

export class Config extends Base {
  plugins: Plugins
}
export default Config
