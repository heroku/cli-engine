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
  get clientDelete (): string { return path.join(this.config.dataDir, 'tmp', 'client.DELETE') }
  get nodeDelete (): string { return path.join(this.config.dataDir, 'tmp', 'node.DELETE') }

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

  _cleanup () {
    this._catch(() => {
      // if the previous update failed we may have cruft left over
      // which will cause the new update to fail on rename
      if (fs.existsSync(this.clientDelete)) {
        fs.removeSync(this.clientDelete)
      }
    })

    this._catch(() => {
      // remove the node executables we left behind to prevent
      // windows from crashing, but do not error out because
      // they may still be in use
      if (fs.existsSync(this.nodeDelete)) {
        fs.readdirSync(this.nodeDelete).forEach(dir => {
          this._catch(() => {
            fs.removeSync(path.join(this.nodeDelete, dir))
          })
        })

        if (fs.readdirSync(this.nodeDelete).length === 0) {
          fs.removeSync(this.nodeDelete)
        }
      }
    })
  }

  async update (manifest: Manifest) {
    if (!this.config.s3.host) throw new Error('S3 host not defined')
    // TODO: read sha256
    let url = `https://${this.config.s3.host}/${this.config.name}/channels/${manifest.channel}/${this.base(manifest)}.tar.gz`
    let stream = await this.http.stream(url)

    let dir = path.join(this.config.dataDir, 'client')
    let tmp = path.join(this.config.dataDir, 'client_tmp')

    await this.extract(stream, tmp)

    let unlock = await lock.write(this.updatelockfile, {skipOwnPid: true})
    this._cleanup()

    // moveSync tries to do a rename first then falls back to copy & delete
    // on windows the delete would error on node.exe so we explicitly rename
    let rename = (this.config.windows) ? fs.renameSync : fs.moveSync

    fs.mkdirpSync(path.dirname((this.clientDelete)))
    rename(dir, this.clientDelete)

    rename(path.join(tmp, this.base(manifest)), dir)
    this._catch(() => {
      fs.removeSync(tmp)
    })

    // move the node executable before trying to delete the old client
    // because it is still in use and will cause the update to fail on windows
    let dirDeleteNode = path.join(this.clientDelete, 'bin', 'node.exe')
    if (fs.existsSync(dirDeleteNode)) {
      fs.mkdirpSync(this.nodeDelete)
      let nodeTmpDeleteDir = require('tmp').dirSync({dir: this.nodeDelete}).name
      rename(dirDeleteNode, path.join(nodeTmpDeleteDir, 'node.exe'))
    }

    this._catch(() => {
      fs.removeSync(this.clientDelete)
    })
    unlock()
    await this.restartCLI()
  }

  extract (stream: stream$Readable, dir: string) {
    const zlib = require('zlib')
    const tar = require('tar-fs')

    return new Promise((resolve, reject) => {
      fs.removeSync(dir)

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
      extract.on('error', reject)
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
    let env = process.env
    let restartCount = (parseInt(env.CLI_RESTART_COUNT) || 0) + 1
    if (restartCount > 10) {
      this.out.warn('CLI seems to be in a restart loop')
      return
    }
    env.CLI_RESTART_COUNT = restartCount.toString()
    if (!this.binPath) return
    const {status} = spawnSync(this.binPath, process.argv.slice(2), {stdio: 'inherit', shell: true, env})
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
