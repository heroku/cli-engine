// @flow

import {type Config} from 'cli-engine-config'
import type Output from 'cli-engine-command/lib/output'
import HTTP from 'cli-engine-command/lib/http'
import path from 'path'
import lock from 'rwlockfile'
import fs from 'fs-extra'
import logChopper from 'log-chopper'
import moment from 'moment'

type Manifest = {
  version: string,
  channel: string,
  sha256gz: string
}

type TmpDirs = {
  dir: string,
  node: string,
  client: string,
  extract: string
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
  get updateDir (): string { return path.join(this.config.dataDir, 'tmp', 'u') }

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

  _catch (fn: Function) {
    try {
      fn()
    } catch (err) {
      this.out.debug(err)
    }
  }

  async update (manifest: Manifest) {
    let base = this.base(manifest)

    if (!this.config.s3.host) throw new Error('S3 host not defined')

    let url = `https://${this.config.s3.host}/${this.config.name}/channels/${manifest.channel}/${base}.tar.gz`
    let stream = await this.http.stream(url)

    fs.mkdirpSync(this.updateDir)
    let dirs = this._dirs(require('tmp').dirSync({dir: this.updateDir}).name)

    let dir = path.join(this.config.dataDir, 'client')
    let tmp = dirs.extract

    await this.extract(stream, tmp, manifest.sha256gz)
    let extracted = path.join(dirs.extract, base)

    this._cleanup()

    let unlock = await lock.write(this.updatelockfile, {skipOwnPid: true})
    if (await fs.exists(dir)) this._rename(dir, dirs.client)
    this._rename(extracted, dir)
    unlock()

    this._cleanupDirs(dirs)
  }

  extract (stream: stream$Readable, dir: string, sha: string) {
    const zlib = require('zlib')
    const tar = require('tar-fs')
    const crypto = require('crypto')

    return new Promise((resolve, reject) => {
      let shaValidated = false
      let extracted = false

      let check = () => {
        if (shaValidated && extracted) {
          resolve()
        }
      }

      let fail = (err) => {
        this._catch(() => {
          if (fs.existsSync(dir)) {
            fs.removeSync(dir)
          }
        })
        reject(err)
      }

      let hasher = crypto.createHash('sha256')
      stream.on('error', fail)
      stream.on('data', d => hasher.update(d))
      stream.on('end', () => {
        let shasum = hasher.digest('hex')
        if (sha === shasum) {
          shaValidated = true
          check()
        } else {
          reject(new Error(`SHA mismatch: expected ${shasum} to be ${sha}`))
        }
      })

      let ignore = function (_, header) {
        switch (header.type) {
          case 'directory':
          case 'file':
            return false
          case 'symlink':
            return true
          default: throw new Error(header.type)
        }
      }
      let extract = tar.extract(dir, {ignore})
      extract.on('error', fail)
      extract.on('finish', () => {
        extracted = true
        check()
      })

      let gunzip = zlib.createGunzip()
      gunzip.on('error', fail)

      stream
      .pipe(gunzip)
      .pipe(extract)
    })
  }

  _cleanup () {
    let dir = this.updateDir
    this._catch(() => {
      if (fs.existsSync(dir)) {
        fs.readdirSync(dir).forEach(d => {
          let dirs = this._dirs(path.join(dir, d))

          this._remove(dirs.node)

          if (moment(fs.statSync(dirs.dir).mtime).isBefore(moment().subtract(24, 'hours'))) {
            this._cleanupDirs(dirs)
          } else {
            this._removeIfEmpty(dirs)
          }
        })
      }
    })
  }

  _cleanupDirs (dirs: TmpDirs) {
    this._moveNode(dirs)

    this._remove(dirs.client)
    this._remove(dirs.extract)
    this._removeIfEmpty(dirs)
  }

  _removeIfEmpty (dirs: TmpDirs) {
    this._catch(() => {
      if (fs.readdirSync(dirs.dir).length === 0) {
        this._remove(dirs.dir)
      }
    })
  }

  _dirs (dir: string) {
    let client = path.join(dir, 'client')
    let extract = path.join(dir, 'extract')
    let node = path.join(dir, 'node.exe')

    return {dir, client, extract, node}
  }

  _rename (src : string, dst : string) {
    this.out.debug(`rename ${src} to ${dst}`)
    // moveSync tries to do a rename first then falls back to copy & delete
    // on windows the delete would error on node.exe so we explicitly rename
    let rename = (this.config.windows) ? fs.renameSync : fs.moveSync
    rename(src, dst)
  }

  _remove (dir : string) {
    this._catch(() => {
      if (fs.existsSync(dir)) {
        this.out.debug(`remove ${dir}`)
        fs.removeSync(dir)
      }
    })
  }

  _moveNode (dirs: TmpDirs) {
    this._catch(() => {
      let dirDeleteNode = path.join(dirs.client, 'bin', 'node.exe')
      if (fs.existsSync(dirDeleteNode)) {
        this._rename(dirDeleteNode, dirs.node)
      }
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

  get autoupdateNeeded () : boolean {
    try {
      const stat = fs.statSync(this.autoupdatefile)
      return moment(stat.mtime).isBefore(moment().subtract(5, 'hours'))
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
