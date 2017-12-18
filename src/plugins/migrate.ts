import { Config } from 'cli-engine-config'
import cli from 'cli-ux'
import deps from '../deps'
import { UserPlugins } from './user'
import { LinkPlugins } from './link'
import { PluginManifest } from './manifest'
import * as path from 'path'
import { Lock } from '../lock'

const debug = require('debug')('cli:migrate')

export class PluginsMigrate {
  private config: Config
  private user: UserPlugins
  private lock: Lock
  private link: LinkPlugins
  private manifest: PluginManifest

  constructor({
    config,
    link,
    user,
    manifest,
  }: {
    config: Config
    link: LinkPlugins
    user: UserPlugins
    manifest: PluginManifest
  }) {
    this.config = config
    this.lock = new deps.Lock(this.config)
    this.link = link
    this.user = user
    this.manifest = manifest
  }

  public async migrate() {
    try {
      await this.migrateUser()
      await this.migrateLinked()
    } catch (err) {
      cli.warn(err)
    }
  }

  private async migrateLinked() {
    const linkedPath = path.join(this.config.dataDir, 'linked_plugins.json')
    if (await deps.file.exists(linkedPath)) {
      const downgrade = await this.lock.upgrade()
      debug('migrating link plugins')
      let linked = await deps.file.fetchJSONFile(linkedPath)
      let promises = linked.plugins.map((l: string) => this.link.install(l))
      for (let p of promises) await p
      await deps.file.remove(linkedPath)
      await downgrade()
    }
  }

  private async migrateUser() {
    const userPath = path.join(this.config.dataDir, 'plugins', 'package.json')
    if (await deps.file.exists(userPath)) {
      let user = await deps.file.fetchJSONFile(userPath)
      if (!user.dependencies || user['cli-engine']) return
      debug('migrating user plugins')
      user = await deps.file.readJSON(userPath)
      if (user['cli-engine']) return
      for (let [name, tag] of Object.entries(user.dependencies)) {
        await this.user.install(name, tag)
      }
      await this.manifest.save()
      user = await deps.file.readJSON(userPath)
      user['cli-engine'] = { schema: 1 }
      await deps.file.outputJSON(userPath, user, { spaces: 2 })
    }
  }
}
