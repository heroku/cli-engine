import cli from 'cli-ux'
import * as path from 'path'

import { ICommandInfo } from './command'
import Config from './config'
import deps from './deps'
import { IPluginModule, IPluginPJSON } from './plugins/plugin'

const debug = require('debug')('cli:hooks')

export abstract class Hook<T extends keyof IHooks> {
  constructor(protected config: Config, protected options: IHooks[T]) {}
  public abstract run(): Promise<void>
}

export interface IHooks {
  init: {}
  update: {}
  'plugins:parse': {
    module: IPluginModule
    pjson: IPluginPJSON
  }
  prerun: {
    Command: ICommandInfo
    argv: string[]
  }
}

interface IConstructor<T, O> {
  new (config: Config, options: O): T
}
type LegacyHook<T extends keyof IHooks> = (config: Config, options: IHooks[T]) => Promise<void>
type HookConstructor<T extends keyof IHooks> = IConstructor<Hook<T>, IHooks[T]>

export class Hooks {
  constructor(private config: Config) {}

  async run<T extends keyof IHooks>(event: T, options: IHooks[T] = {}): Promise<void> {
    let scripts = this.config.hooks[event]
    if (!scripts || !this.config.root) return
    for (let script of scripts) {
      script = path.join(this.config.root, script)
      debug(`%s %s`, event, script)
      let Hook: HookConstructor<T> | LegacyHook<T>
      try {
        Hook = deps.util.undefault(require(script))
      } catch (err) {
        cli.warn(err, { context: `hook:${event} loading ${script}` })
        continue
      }
      if (this.isLegacyHook(Hook)) {
        await Hook(this.config, options)
      } else {
        const hook = new Hook(this.config, options)
        await hook.run()
      }
    }
  }

  private isLegacyHook<T extends keyof IHooks>(Hook: HookConstructor<T> | LegacyHook<T>): Hook is LegacyHook<T> {
    return !Hook.prototype
  }
}
