'use strict'

const {Command} = require('heroku-cli-command')
const path = require('path')
const dirs = require('../lib/dirs')
const lock = require('rwlockfile')
const config = require('../lib/config')
const errors = require('../lib/errors')

class Update extends Command {
  async run () {
    if (config.disableUpdate) this.warn(config.disableUpdate)
    else {
      this.action(`${config.name}: Updating CLI`)
      let channel = this.args.channel || config.channel
      this.manifest = await this.fetchManifest(channel)
      if (config.version === this.manifest.version && channel === config.channel) {
        this.action.done(`already on latest version: ${config.version}`)
      } else {
        this.action(`${config.name}: Updating CLI to ${this.color.green(this.manifest.version)}${channel === 'stable' ? '' : ' (' + this.color.yellow(channel) + ')'}`)
        await this.update(channel)
        this.action.done()
      }
    }
    this.action(`${config.name}: Updating plugins`)
  }

  async fetchManifest (channel) {
    try {
      let url = `https://${config.s3.host}/${config.name}/channels/${channel}/${process.platform}-${process.arch}`
      return await this.http.get(url)
    } catch (err) {
      if (err.statusCode === 403) throw new Error(`HTTP 403: Invalid channel ${channel}`)
      throw err
    }
  }

  async update (channel) {
    let url = `https://${config.s3.host}/${config.name}/channels/${channel}/${this.base}.tar.gz`
    let stream = await this.http.get(url, {raw: true})
    let dir = path.join(dirs.data, 'cli')
    let tmp = path.join(dirs.data, 'cli_tmp')
    await this.extract(stream, tmp)
    await lock.write(dirs.updatelockfile, {skipOwnPid: true})
    this.fs.removeSync(dir)
    this.fs.renameSync(path.join(tmp, this.base), dir)
    this.fs.removeSync(tmp)
  }

  extract (stream, dir) {
    const zlib = require('zlib')
    const tar = require('tar-stream')

    return new Promise(resolve => {
      this.fs.removeSync(dir)
      let extract = tar.extract()
      extract.on('entry', (header, stream, next) => {
        let p = path.join(dir, header.name)
        let opts = {mode: header.mode}
        switch (header.type) {
          case 'directory':
            this.fs.mkdirpSync(p, opts)
            next()
            break
          case 'file':
            stream.pipe(this.fs.createWriteStream(p, opts))
            break
          case 'symlink':
            // ignore symlinks since they will not work on windows
            next()
            break
          default: throw new Error(header.type)
        }
        stream.resume()
        stream.on('end', next)
      })
      extract.on('finish', resolve)
      stream
      .pipe(zlib.createGunzip())
      .pipe(extract)
    })
  }

  get base () {
    return `${config.name}-v${this.manifest.version}-${process.platform}-${process.arch}`
  }

  get fs () {
    return require('fs-extra')
  }

  async restartCLI () {
    await lock.read(dirs.updatelockfile)
    lock.unreadSync(dirs.updatelockfile)
    const {spawnSync} = require('child_process')
    const {status} = spawnSync(config.bin, process.argv.slice(2), {stdio: 'inherit', shell: true})
    process.exit(status)
  }

  get autoupdateNeeded () {
    try {
      const fs = require('fs-extra')
      const moment = require('moment')
      const stat = fs.statSync(dirs.autoupdatefile)
      return moment(stat.mtime).isBefore(moment().subtract(4, 'hours'))
    } catch (err) {
      if (err.code !== 'ENOENT') console.error(err.stack)
      return true
    }
  }

  async autoupdate () {
    try {
      if (!this.autoupdateNeeded) return
      this.fs.writeFileSync(dirs.autoupdatefile, '')
      if (config.disableUpdate) await this.warnIfUpdateAvailable()
      await this.checkIfUpdating()
      const {spawn} = require('child_process')
      spawn(config.bin, ['update'])
    } catch (err) {
      this.error('error autoupdating')
      this.error(err)
      errors.logError(err)
    }
  }

  async warnIfUpdateAvailable () {
    const manifest = await this.fetchManifest(config.channel)
    let local = config.version.split('.')
    let remote = manifest.version.split('.')
    if (local[0] !== remote[0] || local[1] !== remote[1]) {
      console.error(`${config.name}: update available from ${config.version} to ${manifest.version}`)
    }
  }

  async checkIfUpdating () {
    const lock = require('rwlockfile')
    if (await lock.hasWriter(dirs.updatelockfile)) {
      console.error(`${config.name}: warning: update in process`)
      await this.restartCLI()
    } else await lock.read(dirs.updatelockfile)
  }
}

Update.topic = 'update'
Update.args = [
  {name: 'channel', optional: true}
]

module.exports = Update
