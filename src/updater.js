// @flow
/* globals
   stream$Readable
*/

import {Base} from 'cli-engine-command'
import path from 'path'
import lock from 'rwlockfile'

type Manifest = {
  version: string,
  channel: string,
  sha256: string
}

export default class extends Base {
  get autoupdatefile (): string { return path.join(this.config.dirs.cache, 'autoupdate') }
  get autoupdatelogfile (): string { return path.join(this.config.dirs.cache, 'autoupdate.log') }
  get updatelockfile (): string { return path.join(this.config.dirs.cache, 'update.lock') }

  async fetchManifest (channel: string): Promise<Manifest> {
    if (!this.config.s3.host) throw new Error('S3 host not defined')
    try {
      let url = `https://${this.config.s3.host}/${this.config.name}/channels/${channel}/${process.platform}-${process.arch}`
      let manifest = await this.http.get(url)
      return ((manifest: any): Promise<Manifest>)
    } catch (err) {
      if (err.statusCode === 403) throw new Error(`HTTP 403: Invalid channel ${channel}`)
      throw err
    }
  }

  async update (manifest: Manifest) {
    if (!this.config.s3.host) throw new Error('S3 host not defined')
    let url = `https://${this.config.s3.host}/${this.config.name}/channels/${manifest.channel}/${this.base(manifest)}.tar.gz`
    let stream = await this.http.stream(url)
    let dir = path.join(this.config.dirs.data, 'cli')
    let tmp = path.join(this.config.dirs.data, 'cli_tmp')
    await this.extract(stream, tmp)
    await lock.write(this.updatelockfile, {skipOwnPid: true})
    this.fs.removeSync(dir)
    this.fs.renameSync(path.join(tmp, this.base(manifest)), dir)
    this.fs.removeSync(tmp)
  }

  extract (stream: stream$Readable, dir: string) {
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

  base (manifest: Manifest): string {
    return `${this.config.name}-v${manifest.version}-${process.platform}-${process.arch}`
  }

  async restartCLI () {
    await lock.read(this.updatelockfile)
    lock.unreadSync(this.updatelockfile)
    const {spawnSync} = require('child_process')
    const {status} = spawnSync(this.config.binPath, process.argv.slice(2), {stdio: 'inherit', shell: true})
    this.exit(status)
  }

  get autoupdateNeeded () {
    try {
      const moment = require('moment')
      const stat = this.fs.statSync(this.autoupdatefile)
      return moment(stat.mtime).isBefore(moment().subtract(4, 'hours'))
    } catch (err) {
      if (err.code !== 'ENOENT') console.error(err.stack)
      return true
    }
  }

  async autoupdate () {
    try {
      if (!this.autoupdateNeeded) return
      this.fs.writeFileSync(this.autoupdatefile, '')
      if (this.config.updateDisabled) await this.warnIfUpdateAvailable()
      await this.checkIfUpdating()
      let fd = this.fs.openSync(this.autoupdatelogfile, 'a')
      const {spawn} = require('child_process')
      spawn(this.config.binPath, ['update'], {stdio: [null, fd, fd], detached: true})
      .on('error', e => this.warn(e, 'autoupdate:'))
    } catch (e) { this.warn(e, 'autoupdate:') }
  }

  async warnIfUpdateAvailable () {
    const manifest = await this.fetchManifest(this.config.channel)
    let local = this.config.version.split('.')
    let remote = manifest.version.split('.')
    if (local[0] !== remote[0] || local[1] !== remote[1]) {
      this.stderr.log(`${this.config.name}: update available from ${this.config.version} to ${manifest.version}`)
    }
  }

  async checkIfUpdating () {
    const lock = require('rwlockfile')
    if (await lock.hasWriter(this.updatelockfile)) {
      this.warn(`${this.config.name}: warning: update in process`)
      await this.restartCLI()
    } else await lock.read(this.updatelockfile)
  }
}
