// @flow

import Command from 'cli-engine-command'
import Plugins from './plugins'
import path from 'path'
import fs from 'fs-extra'

export default class extends Command {
  plugins: Plugins

  async run () {
    this.plugins = new Plugins(this.out)
    let file = path.join(this.config.dataDir, 'plugins', 'plugins.json')
    let pljson = await this.getPluginsJson(file)
    if (!pljson) return
    this.out.debug('Migrating V5 plugins...')
    for (let p of pljson) {
      if (this.plugins.isPluginInstalled(p.name)) {
        this.out.debug(`Skipping already installed plugin: ${p.name}`)
      } else {
        await this.installPlugin(p.name, p.tag)
      }
    }
  }

  async getPluginsJson (file: string) {
    try {
      return fs.readJSONSync(file)
    } catch (err) {
      this.out.debug(err.message)
    }
  }

  async installPlugin (name: string, tag: string) {
    try {
      if (tag === 'symlink') {
        await this.reinstallViaSymlink(name)
      } else {
        if (tag === '') tag = 'latest'
        await this.addToPJSON(name, tag)
      }
    } catch (err) {
      this.out.warn(err)
    }
  }

  async reinstallViaSymlink (name: string) {
    this.out.debug(`Installing via symlink: ${name}`)
    let pluginPath = fs.realpathSync(path.join(this.config.dataDir, 'plugins', 'node_modules', name))
    await this.plugins.addLinkedPlugin(pluginPath)
  }

  async addToPJSON (name: string, tag: string) {
    this.out.debug(`Adding to plugins pjson: ${name}`)
    this.plugins.addPackageToPJSON(name, tag)
  }
}
