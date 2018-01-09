import cli from 'cli-ux'
import * as path from 'path'
import RWLockfile, { rwlockfile } from 'rwlockfile'

import Config from '../config'
import deps from '../deps'

import Yarn from './yarn'

export default class UserPlugins {
  public yarn = new Yarn({ config: this.config, cwd: this.userPluginsDir })
  private lock: RWLockfile
  private debug = require('debug')('cli:plugins:user')

  constructor(private config: Config) {}

  @rwlockfile('lock', 'write')
  public async update() {
    cli.action.start(`${this.config.name}: Updating plugins`)
    const packages = deps.util.objEntries(await this.manifestPlugins()).map(([k, v]) => `${k}@${v.tag}`)
    await this.yarn.exec(['upgrade', ...packages])
    await this.refresh(true)
  }

  @rwlockfile('lock', 'write')
  public async install(name: string, tag: string): Promise<void> {
    cli.action.start(`Installing ${name}@${tag}`)
    await this.addPlugin(name, tag)
    cli.action.stop()
  }

  @rwlockfile('lock', 'write')
  public async uninstall(name: string) {
    return await this.removePlugin(name)
  }

  public async refresh(force = false) {
    const nodeVersionChanged = (await this.yarnNodeVersion()) !== process.version
    if (!force && !nodeVersionChanged) return
    if (nodeVersionChanged) cli.action.start(`Updating plugins, node version changed to ${process.versions.node}`)
    await this.lock.add('write', { reason: 'refresh' })
    try {
      await this.yarn.exec()
      for (let p of this.plugins.map(p => p.reset())) await p
    } finally {
      await this.lock.remove('write')
    }
  }

  private get userPluginsDir() {
    return path.join(this.config.dataDir, 'plugins')
  }
  private get pjsonPath() {
    return path.join(this.userPluginsDir, 'package.json')
  }

  private async createPJSON() {
    if (!await deps.file.exists(this.pjsonPath)) {
      await deps.file.outputJSON(this.pjsonPath, { private: true, 'cli-engine': { schema: 1 } }, { spaces: 2 })
    }
  }

  private async migrate() {
    const userPath = path.join(this.config.dataDir, 'plugins', 'package.json')
    if (!await deps.file.exists(userPath)) return
    await this.lock.add('read', { reason: 'migrate' })
    try {
      let user = await deps.file.readJSON(userPath)
      if (!user.dependencies || user['cli-engine']) return
      await this.lock.add('write', { reason: 'migrate' })
      try {
        cli.action.start('Refreshing plugins')
        await deps.file.remove(path.join(this.config.dataDir, 'plugins/node_modules'))
        await this.createPJSON()
        await this.yarn.exec()
        this.debug('migrating user plugins')
        for (let [name, tag] of deps.util.objEntries<string>(user.dependencies)) {
          await this.addPlugin(name, tag)
        }
        user['cli-engine'] = { schema: 1 }
        await deps.file.outputJSON(userPath, user)
      } finally {
        await this.lock.remove('write')
      }
    } finally {
      await this.lock.remove('read')
    }
  }

  private async addPlugin(name: string, tag: string) {
    try {
      await this.createPJSON()
      await this.yarn.exec(['add', `${name}@${tag}`])
    } catch (err) {
      await this.removePlugin(name).catch(err => this.debug(err))
      throw err
    }
  }

  private async removePlugin(name: string) {
    await this.yarn.exec(['remove', name])
  }

  private async yarnNodeVersion(): Promise<string | undefined> {
    try {
      let f = await deps.file.readJSON(path.join(this.userPluginsDir, 'node_modules', '.yarn-integrity'))
      return f.nodeVersion
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }
  }
}
