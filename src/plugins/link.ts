import { cli } from 'cli-ux'
import { Plugin, PluginPJSON, PluginOptions, PluginType } from './plugin'
import * as path from 'path'
import * as fs from 'fs-extra'
import { PluginManager } from './manager'
import deps from '../deps'

function touch(f: string) {
  fs.utimesSync(f, new Date(), new Date())
}

function linkPJSON(root: string): Promise<PluginPJSON> {
  return deps.file.fetchJSONFile(path.join(root, 'package.json'))
}

async function getNewestJSFile(root: string): Promise<Date> {
  let oldest = new Date()
  return new Promise<Date>((resolve, reject) => {
    deps
      .klaw(root, {
        depthLimit: 10,
        filter: f => {
          return !['.git', 'node_modules'].includes(path.basename(f))
        },
      })
      .on('data', f => {
        if (f.stats.isDirectory()) return
        if (f.path.endsWith('.js') || f.path.endsWith('.ts')) {
          if (f.stats.mtime > oldest) oldest = f.stats.mtime
        }
      })
      .on('error', reject)
      .on('end', () => resolve(oldest))
  })
}

export class LinkPlugins extends PluginManager {
  public plugins: LinkPlugin[]

  public async install(root: string): Promise<void> {
    this.debug('installing', root)
    const plugin = await this.loadPlugin(root)
    await plugin.init()
  }

  public async findByRoot(root: string): Promise<LinkPlugin | undefined> {
    await this.init()
    root = path.resolve(root)
    return this.plugins.find(p => path.resolve(p.root) === root)
  }

  protected async _init(): Promise<void> {
    const defs = await this.manifest.list('link')
    const promises = defs.map(p => this.loadPlugin(p.root, p.lastUpdated))
    this.submanagers = this.plugins = await Promise.all(promises)
  }

  private async loadPlugin(root: string, lastUpdated?: Date) {
    const pjson = await linkPJSON(root)
    return new LinkPlugin({
      name: pjson.name,
      cache: this.cache,
      config: this.config,
      lastUpdated,
      root,
    })
  }
}

export class LinkPlugin extends Plugin {
  public type: PluginType = 'link'

  private lastUpdated: Date | undefined

  constructor(opts: { lastUpdated?: Date } & PluginOptions) {
    super(opts)
    this.lastUpdated = opts.lastUpdated
  }

  protected async _init() {
    this.pjson = await linkPJSON(this.root)
    if (await this.updateNodeModulesNeeded()) {
      await this.updateNodeModules()
    } else if (await this.prepareNeeded()) {
      await this.prepare()
    }
    await super._init()
  }

  private async updateNodeModulesNeeded(): Promise<boolean> {
    if (!this.lastUpdated) return true
    let modules = path.join(this.root, 'node_modules')
    if (!await deps.file.exists(modules)) return true
    let modulesInfo = await fs.stat(modules)
    let pjsonInfo = await fs.stat(path.join(this.root, 'package.json'))
    return modulesInfo.mtime < pjsonInfo.mtime
  }

  private async updateNodeModules(): Promise<void> {
    cli.action.start(`Installing node modules for ${this.root}`)
    const yarn = new deps.Yarn({ config: this.config, cwd: this.root })
    await yarn.exec()
    touch(path.join(this.root, 'node_modules'))
    await this.prepare()
  }

  private async prepareNeeded(): Promise<boolean> {
    const main = this.pjson.main
    if (main && !await deps.file.exists(path.join(this.root, main))) return true
    return this.lastUpdated! > (await getNewestJSFile(this.root))
  }

  private async prepare() {
    const { scripts } = this.pjson
    if (!scripts || !scripts.prepare) return
    cli.action.start(`Running prepare script for ${this.root}`)
    const yarn = new deps.Yarn({ config: this.config, cwd: this.root })
    await yarn.exec(['run', 'prepare'])
    // await this.cache.reset(this)
    cli.action.stop()
  }
}
