// @flow
/* globals
   stream$Readable
*/
import Command from 'cli-engine-command'
import path from 'path'
import dirs from '../dirs'
import lock from 'rwlockfile'
import config from '../config'
import errors from '../errors'
import fs from 'fs-extra'

type Manifest = {
  version: string,
  channel: string,
  sha256: string
}

class Update extends Command {
  async run () {
    if (config.disableUpdate) this.warn(config.disableUpdate)
    else {
      this.action.start(`${config.name}: Updating CLI`)
      let channel = this.args.channel || config.channel
      let manifest = await this.fetchManifest(channel)
      if (config.version === manifest.version && channel === config.channel) {
        this.action.stop(`already on latest version: ${config.version}`)
      } else {
        this.action.start(`${config.name}: Updating CLI to ${this.color.green(manifest.version)}${channel === 'stable' ? '' : ' (' + this.color.yellow(channel) + ')'}`)
        await this.update(manifest)
        this.action.stop()
      }
    }
    this.action.start(`${config.name}: Updating plugins`)
  }

  async fetchManifest (channel: string): Promise<Manifest> {
    try {
      let url = `https://${config.s3.host}/${config.name}/channels/${channel}/${process.platform}-${process.arch}`
      let manifest = await this.http.get(url)
      return ((manifest: any): Promise<Manifest>)
    } catch (err) {
      if (err.statusCode === 403) throw new Error(`HTTP 403: Invalid channel ${channel}`)
      throw err
    }
  }

  async update (manifest: Manifest) {
    let url = `https://${config.s3.host}/${config.name}/channels/${manifest.channel}/${this.base(manifest)}.tar.gz`
    let stream = await this.http.stream(url)
    let dir = path.join(dirs.data, 'cli')
    let tmp = path.join(dirs.data, 'cli_tmp')
    await this.extract(stream, tmp)
    await lock.write(dirs.updatelockfile, {skipOwnPid: true})
    fs.removeSync(dir)
    fs.renameSync(path.join(tmp, this.base(manifest)), dir)
    fs.removeSync(tmp)
  }

  extract (stream: stream$Readable, dir: string) {
    const zlib = require('zlib')
    const tar = require('tar-stream')

    return new Promise(resolve => {
      fs.removeSync(dir)
      let extract = tar.extract()
      extract.on('entry', (header, stream, next) => {
        let p = path.join(dir, header.name)
        let opts = {mode: header.mode}
        switch (header.type) {
          case 'directory':
            fs.mkdirpSync(p, opts)
            next()
            break
          case 'file':
            stream.pipe(fs.createWriteStream(p, opts))
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

  base (manifest: Manifest): string {
    return `${config.name}-v${manifest.version}-${process.platform}-${process.arch}`
  }

  async restartCLI () {
    await lock.read(dirs.updatelockfile)
    lock.unreadSync(dirs.updatelockfile)
    const {spawnSync} = require('child_process')
    const {status} = spawnSync(config.reexecBin, process.argv.slice(2), {stdio: 'inherit', shell: true})
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
      fs.writeFileSync(dirs.autoupdatefile, '')
      if (config.disableUpdate) await this.warnIfUpdateAvailable()
      await this.checkIfUpdating()
      let fd = fs.openSync(dirs.autoupdatelog, 'a')
      const {spawn} = require('child_process')
      spawn(dirs.reexecBin, ['update'], {stdio: [null, fd, fd], detached: true})
      .on('error', errors.logError)
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
