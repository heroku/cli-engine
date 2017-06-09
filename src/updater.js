// @flow

import {type Config} from 'cli-engine-config'
import type Output from 'cli-engine-command/lib/output'
import HTTP from 'cli-engine-command/lib/http'
import path from 'path'
import lock from 'rwlockfile'
import fs from 'fs-extra'
import moment from 'moment'

type Version = {
  version: string,
  channel: string
}

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

function mtime (f) {
  return moment(fs.statSync(f).mtime)
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
  get versionFile (): string { return path.join(this.config.cacheDir, `${this.config.channel}.version`) }

  s3url (channel: string, p: string): string {
    if (!this.config.s3.host) throw new Error('S3 host not defined')
    return `https://${this.config.s3.host}/${this.config.name}/channels/${channel}/${p}`
  }

  async fetchManifest (channel: string): Promise<Manifest> {
    try {
      return await this.http.get(this.s3url(channel, `${this.config.platform}-${this.config.arch}`))
    } catch (err) {
      if (err.statusCode === 403) throw new Error(`HTTP 403: Invalid channel ${channel}`)
      throw err
    }
  }

  async fetchVersion (channel: string, daysToStale: ?number = 30): Promise<Version> {
    let v
    try {
      if (!daysToStale || mtime(this.versionFile).isAfter(moment().subtract(daysToStale, 'days'))) {
        v = await fs.readJSON(this.versionFile)
      }
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }
    if (!v) {
      v = await this.http.get(this.s3url(channel, 'version'))
      await this._catch(() => fs.writeJSON(this.versionFile, v))
    }
    return v
  }

  _catch (fn: Function) {
    try {
      return Promise.resolve(fn())
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

          if (mtime(dirs.dir).isBefore(moment().subtract(24, 'hours'))) {
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

  _rename (src: string, dst: string) {
    this.out.debug(`rename ${src} to ${dst}`)
    // moveSync tries to do a rename first then falls back to copy & delete
    // on windows the delete would error on node.exe so we explicitly rename
    let rename = this.config.windows ? fs.renameSync : fs.moveSync
    rename(src, dst)
  }

  _remove (dir: string) {
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
    return `${this.config.name}-v${manifest.version}-${this.config.platform}-${this.config.arch}`
  }

  async restartCLI () {
    await lock.read(this.updatelockfile)
    lock.unreadSync(this.updatelockfile)
    const {spawnSync} = require('child_process')
    if (!this.binPath) return
    const {status} = spawnSync(this.binPath, process.argv.slice(2), {stdio: 'inherit', shell: true})
    this.out.exit(status)
  }

  get autoupdateNeeded (): boolean {
    try {
      return mtime(this.autoupdatefile).isBefore(moment().subtract(5, 'hours'))
    } catch (err) {
      if (err.code !== 'ENOENT') console.error(err.stack)
      return true
    }
  }

  async autoupdate (force: boolean = false) {
    try {
      await this.warnIfUpdateAvailable()
      if (!force && !this.autoupdateNeeded) return
      fs.outputFileSync(this.autoupdatefile, '')
      await this.checkIfUpdating()
      let fd = fs.openSync(this.autoupdatelogfile, 'a')
      if (!this.binPath) return
      const {spawn} = require('child_process')
      spawn(this.binPath, ['update'], {detached: true, stdio: ['ignore', fd, fd]})
      .on('error', e => this.out.warn(e, 'autoupdate:'))
      .unref()
    } catch (e) { this.out.warn(e, 'autoupdate:') }
  }

  async warnIfUpdateAvailable () {
    await this._catch(async () => {
      let v = await this.fetchVersion(this.config.channel)
      let local = this.config.version.split('.')
      let remote = v.version.split('.')
      if (parseInt(local[0]) < parseInt(remote[0]) || parseInt(local[1]) < parseInt(remote[1])) {
        this.out.warn(`${this.config.name}: update available from ${this.config.version} to ${v.version}`)
      }
    })
  }

  async checkIfUpdating () {
    if (await lock.hasWriter(this.updatelockfile)) {
      this.out.warn(`${this.config.name}: warning: update in process`)
      await this.restartCLI()
    } else await lock.read(this.updatelockfile)
  }
}
