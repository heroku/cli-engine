import * as config from '@cli-engine/config'

import deps from './deps'
import Engine from './engine'

export interface ConfigOptions extends config.ConfigOptions {
  parent?: NodeModule | null
}

export default class Config extends config.Config {
  readonly parent?: {filename?: string}
  private _engine: Engine

  constructor (config: ConfigOptions = {}) {
    super(config)
    if (config.parent) this.parent = config.parent
  }

  get engine(): Engine { return this._engine || (this._engine = new deps.Engine(this)) }
  get reexecBin() { return super.reexecBin || (this.parent && this.parent.filename) }
}

export * from '@cli-engine/config'
