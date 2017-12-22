import { ICommand, IConfig } from 'cli-engine-config'
import * as path from 'path'
import deps from './deps'
import { IPluginModule, IPluginPJSON } from './plugins/plugin'

const debug = require('debug')('cli:hooks')

export abstract class Hook<T extends keyof IHooks> {
  constructor(protected config: IConfig) {}
  public abstract run(options: IHooks[T]): Promise<void>
}

export interface IHooks {
  init: {}
  update: {}
  'plugins:parse': {
    module: IPluginModule
    pjson: IPluginPJSON
  }
  prerun: {
    Command: ICommand
    argv: string[]
  }
}

interface IConstructor<T> {
  new (config: IConfig): T
}
type LegacyHook<T extends keyof IHooks> = (config: IConfig, options: IHooks[T]) => Promise<void>
type HookConstructor<T extends keyof IHooks> = IConstructor<Hook<T>>

export class Hooks {
  constructor(private config: IConfig) {}

  async run<T extends keyof IHooks>(event: T, options: IHooks[T] = {}): Promise<void> {
    let scripts = this.config.hooks[event]
    if (!scripts) return
    for (let script of scripts) {
      script = path.join(this.config.root, script)
      debug(`%s %s`, event, script)
      const Hook: HookConstructor<T> | LegacyHook<T> = deps.util.undefault(require(script))
      if (this.isLegacyHook(Hook)) {
        await Hook(this.config, options)
      } else {
        const hook = new Hook(this.config)
        await hook.run(options)
      }
    }
  }

  private isLegacyHook<T extends keyof IHooks>(Hook: HookConstructor<T> | LegacyHook<T>): Hook is LegacyHook<T> {
    return !Hook.prototype
  }
}
