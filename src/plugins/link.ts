import cli from 'cli-ux'
import * as fs from 'fs-extra'
import * as path from 'path'
import { rwlockfile } from 'rwlockfile'

import Config from '../config'
import deps from '../deps'

function touch(f: string) {
  fs.utimesSync(f, new Date(), new Date())
}

function pjsonPath(root: string) {
  return path.join(root, 'package.json')
}

export interface IManifestPlugin {
  name: string
  root: string
}

async function getNewestJSFile(root: string): Promise<Date> {
  let files = await deps.file.walk(root, {
    depthLimit: 20,
    filter: f => !['.git', 'node_modules'].includes(path.basename(f)),
  })
  return files.reduce((prev, f): Date => {
    if (f.stats.isDirectory()) return prev
    if (f.path.endsWith('.js') || f.path.endsWith('.ts')) {
      if (f.stats.mtime > prev) {
        return f.stats.mtime
      }
    }
    return prev
  }, new Date(0))
}

export class NoCommandsError extends Error {
  code = 'ENOCOMMANDS'

  constructor(name: string) {
    super(`${name} has no commands. Is this a CLI plugin?`)
  }
}

export default class LinkPlugins {
  // private debug = require('debug')('cli:plugins:link')

  constructor(private _: Config) {}

  @rwlockfile('lock', 'write')
  public async install(root: string): Promise<void> {
    cli.action.start(`Linking ${root}`)
  }

  @rwlockfile('lock', 'write')
  public async uninstall(_: string) {
  }

  private async migrate() {
    // const linkedPath = path.join(this.config.dataDir, 'linked_plugins.json')
    // if (!await deps.file.exists(linkedPath)) return
    // try {
    //   // await this.lock.add('write', { reason: 'migrate' })
    //   cli.action.start('migrating link plugins')
    //   let linked = await deps.file.readJSON(linkedPath)
    //   for (let root of linked.plugins) {
    //     cli.action.status = root
    //     await this.addPlugin(root)
    //   }
    //   cli.action.stop()
    //   await deps.file.remove(linkedPath)
    // } finally {
    //   // await this.lock.remove('write')
    // }
  }
}

export class LinkPlugin extends Plugin {
  public type: PluginType = 'link'
  private manifest: PluginManifest

  constructor(opts: IPluginOptions) {
    super(opts)
    this.manifest = new deps.PluginManifest({
      name: 'link',
      file: path.join(this.config.dataDir, 'plugins', 'link', `${this.name}.json`),
    })
  }

  @rwlockfile('lock', 'read')
  public async refresh(force = false) {
    if (force || (await this.updateNodeModulesNeeded())) await this.updateNodeModules()
    else if (await this.prepareNeeded()) await this.prepare()
    deps.validate.pluginPjson(this.pjson, pjsonPath(this.root))
  }

  @rwlockfile('lock', 'write')
  public async reset() {
    await super.reset(true)
    await this.manifest.set('lastUpdated', new Date().toISOString())
    await this.manifest.save()
  }

  private async updateNodeModulesNeeded(): Promise<boolean> {
    if ((await this.yarnNodeVersion()) !== process.version) return true
    let modules = path.join(this.root, 'node_modules')
    if (!await deps.file.exists(modules)) return true
    let modulesInfo = await fs.stat(modules)
    let pjsonInfo = await fs.stat(path.join(this.root, 'package.json'))
    return modulesInfo.mtime < pjsonInfo.mtime
  }

  private async prepareNeeded(): Promise<boolean> {
    const main = this.pjson.main
    if (main && !await deps.file.exists(path.join(this.root, main))) return true
    return (await this.lastUpdated()) < (await getNewestJSFile(this.root))
  }

  @rwlockfile('lock', 'write')
  private async updateNodeModules(): Promise<void> {
    if (!cli.action.running) {
      cli.action.start(`Refreshing linked plugin ${this.name}`, 'yarn install')
    }
    this.debug('update node modules')
    const yarn = new deps.Yarn({ config: this.config, cwd: this.root })
    await yarn.exec()
    touch(path.join(this.root, 'node_modules'))
    await this.reset()
  }

  @rwlockfile('lock', 'write')
  private async prepare() {
    if (!cli.action.running) {
      cli.action.start(`Refreshing linked plugin ${this.name}`, 'yarn run prepare')
    }
    const { scripts } = this.pjson
    if (scripts && scripts.prepare) {
      const yarn = new deps.Yarn({ config: this.config, cwd: this.root })
      await yarn.exec(['run', 'prepare'])
    }
    await this.reset()
  }

  private async lastUpdated(): Promise<Date> {
    const lastUpdated = await this.manifest.get('lastUpdated')
    return lastUpdated ? new Date(lastUpdated) : new Date(0)
  }

  private async yarnNodeVersion(): Promise<string | undefined> {
    try {
      let f = await deps.file.readJSON(path.join(this.root, 'node_modules', '.yarn-integrity'))
      return f.nodeVersion
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }
  }
}
