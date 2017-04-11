// @flow

import {type Config} from 'cli-engine-config'
import type Output from 'cli-engine-command/lib/output'
import HTTP from 'cli-engine-command/lib/http'
import path from 'path'
import lock from 'rwlockfile'
import fs from 'fs-extra'
import logChopper from 'log-chopper'

type Manifest = {
  version: string,
  channel: string,
  sha256gz: string
}

export default class Updater {
  config: Config
  out: Output
  http: HTTP

  constructor (output: Output) {
    this.out = output
    this.config = output.config
    this.http = new HTTP(output)
  }

  get autoupdatefile (): string { return path.join(this.config.cacheDir, 'autoupdate') }
  get autoupdatelogfile (): string { return path.join(this.config.cacheDir, 'autoupdate.log') }
  get updatelockfile (): string { return path.join(this.config.cacheDir, 'update.lock') }
  get binPath (): ?string { return process.env.CLI_BINPATH }

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
    // TODO: read sha256
    let url = `https://${this.config.s3.host}/${this.config.name}/channels/${manifest.channel}/${this.base(manifest)}.tar.gz`
    let stream = await this.http.stream(url)
    let dir = path.join(this.config.dataDir, 'cli')
    let tmp = path.join(this.config.dataDir, 'cli_tmp')
    await this.extract(stream, tmp)
    let unlock = await lock.write(this.updatelockfile, {skipOwnPid: true})
    fs.removeSync(dir)
    fs.renameSync(path.join(tmp, this.base(manifest)), dir)
    fs.removeSync(tmp)
    unlock()
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
    return `${this.config.name}-v${manifest.version}-${process.platform}-${process.arch}`
  }

  async restartCLI () {
    await lock.read(this.updatelockfile)
    lock.unreadSync(this.updatelockfile)
    const {spawnSync} = require('child_process')
    if (!this.binPath) return
    const {status} = spawnSync(this.binPath, process.argv.slice(2), {stdio: 'inherit', shell: true})
    this.out.exit(status)
  }

  get autoupdateNeeded () {
    try {
      const moment = require('moment')
      const stat = fs.statSync(this.autoupdatefile)
      return moment(stat.mtime).isBefore(moment().subtract(4, 'hours'))
    } catch (err) {
      if (err.code !== 'ENOENT') console.error(err.stack)
      return true
    }
  }

  async autoupdate () {
    try {
      if (!this.autoupdateNeeded) return
      fs.writeFileSync(this.autoupdatefile, '')
      if (this.config.updateDisabled) await this.warnIfUpdateAvailable()
      await this.checkIfUpdating()
      let fd = fs.openSync(this.autoupdatelogfile, 'a')
      if (!this.binPath) return
      const {spawn} = require('child_process')
      spawn(this.binPath, ['update'], {stdio: [null, fd, fd]})
      .on('error', e => this.out.warn(e, 'autoupdate:'))
    } catch (e) { this.out.warn(e, 'autoupdate:') }
    try {
      await logChopper.chop(this.out.errlog)
    } catch (e) { this.out.debug(e.message) }
  }

  async warnIfUpdateAvailable () {
    const manifest = await this.fetchManifest(this.config.channel)
    let local = this.config.version.split('.')
    let remote = manifest.version.split('.')
    if (local[0] !== remote[0] || local[1] !== remote[1]) {
      this.out.warn(`${this.config.name}: update available from ${this.config.version} to ${manifest.version}`)
    }
  }

  async checkIfUpdating () {
    if (await lock.hasWriter(this.updatelockfile)) {
      this.out.warn(`${this.config.name}: warning: update in process`)
      await this.restartCLI()
    } else await lock.read(this.updatelockfile)
  }
}
