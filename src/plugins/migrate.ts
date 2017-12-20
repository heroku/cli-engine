import { Config } from 'cli-engine-config'
import cli from 'cli-ux'
import deps from '../deps'
import { PluginManifest } from './manifest'
import * as path from 'path'

const debug = require('debug')('cli:migrate')

export class PluginsMigrate {
  private config: Config
  private manifest: PluginManifest

  constructor({ config, manifest }: { config: Config; manifest: PluginManifest }) {
    this.config = config
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
      debug('migrating link plugins')
      let linked = await deps.file.readJSON(linkedPath)
      for (let root of linked.plugins) {
        const name = await deps.file.readJSON(path.join(root, 'package.json'))
        this.manifest.add({ type: 'link', name, root })
      }
      await deps.file.remove(linkedPath)
    }
  }

  private async migrateUser() {
    const userPath = path.join(this.config.dataDir, 'plugins', 'package.json')
    if (await deps.file.exists(userPath)) {
      let user = await deps.file.readJSON(userPath)
      if (!user.dependencies || user['cli-engine']) return
      debug('migrating user plugins')
      user = await deps.file.readJSON(userPath)
      if (user['cli-engine']) return
      for (let [name, tag] of Object.entries(user.dependencies)) {
        this.manifest.add({ type: 'user', name, tag })
      }
      user = await deps.file.readJSON(userPath)
      user['cli-engine'] = { schema: 1 }
      await deps.file.outputJSON(userPath, user)
    }
  }
}
