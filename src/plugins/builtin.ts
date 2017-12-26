import { IPluginOptions, Plugin, PluginType } from './plugin'

export interface IBuiltinPluginOptions extends IPluginOptions {
  commandsDir: string
  type: PluginType
}

export class Builtin extends Plugin {
  public type: PluginType
  private _commandsDir: string

  constructor(opts: IBuiltinPluginOptions) {
    super(opts)
    this.type = opts.type
    this._commandsDir = opts.commandsDir
  }

  public get commandsDir() {
    return this._commandsDir
  }
}
