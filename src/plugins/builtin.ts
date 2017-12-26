import { IPluginOptions, Plugin, PluginType } from './plugin'

export interface IBuiltinPluginOptions extends IPluginOptions {
  type: PluginType
}

export class Builtin extends Plugin {
  public type: PluginType

  constructor(opts: IBuiltinPluginOptions) {
    super(opts)
    this.type = opts.type
  }
}
