import deps from './deps'
import * as path from 'path'
import * as fs from 'fs-extra'

import { Lock } from './lock'
import { Config } from 'cli-engine-config'
import { cli } from 'cli-ux'

const debug = require('debug')('cli:updater')

export type Version = {
  version: string
  channel: string
  message?: string
}

export type Manifest = {
  version: string
  channel: string
  sha256gz: string
}

type TmpDirs = {
  dir: string
  node: string
  client: string
  extract: string
}

function mtime(f: string) {
  return deps.moment(fs.statSync(f).mtime)
}

function timestamp(msg: string): string {
  return `[${deps.moment().format()}] ${msg}`
}

export class Updater {
  config: Config
  lock: Lock

  constructor(config: Config) {
    this.config = config
    this.lock = new deps.Lock(config)
  }

  get autoupdatefile(): string {
    return path.join(this.config.cacheDir, 'autoupdate')
  }
  get autoupdatelogfile(): string {
    return path.join(this.config.cacheDir, 'autoupdate.log')
  }
  get binPath(): string | undefined {
    return this.config.reexecBin || this.config.bin
  }
  get updateDir(): string {
    return path.join(this.config.dataDir, 'tmp', 'u')
  }
  get versionFile(): string {
    return path.join(this.config.cacheDir, `${this.config.channel}.version`)
  }

  s3url(channel: string, p: string): string {
    if (!this.config.s3.host) throw new Error('S3 host not defined')
    return `https://${this.config.s3.host}/${this.config.name}/channels/${channel}/${p}`
  }

  async fetchManifest(channel: string): Promise<Manifest> {
    try {
      let { body } = await deps.HTTP.get(this.s3url(channel, `${this.config.platform}-${this.config.arch}`))
      return body
    } catch (err) {
      if (err.statusCode === 403) throw new Error(`HTTP 403: Invalid channel ${channel}`)
      throw err
    }
  }

  async fetchVersion(download: boolean): Promise<Version> {
    let v: Version | undefined
    try {
      if (!download) v = await fs.readJSON(this.versionFile)
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }
    if (!v) {
      debug('fetching latest %s version', this.config.channel)
      let { body } = await deps.HTTP.get(this.s3url(this.config.channel, 'version'))
      v = body
      await this._catch(() => fs.writeJSON(this.versionFile, v))
    }
    return v!
  }

  async _catch(fn: Function) {
    try {
      return await Promise.resolve(fn())
    } catch (err) {
      debug(err)
    }
  }

  async update(manifest: Manifest) {
    let base = this.base(manifest)
    const filesize = require('filesize')

    if (!this.config.s3.host) throw new Error('S3 host not defined')

    let url = `https://${this.config.s3.host}/${this.config.name}/channels/${manifest.channel}/${base}.tar.gz`
    let { response: stream } = await deps.HTTP.stream(url)

    if ((<any>cli.action).frames) {
      // if spinner action
      let total = stream.headers['content-length']
      let current = 0
      const throttle = require('lodash.throttle')
      const updateStatus = throttle(
        (newStatus: string) => {
          cli.action.status = newStatus
        },
        500,
        { leading: true, trailing: false },
      )
      stream.on('data', data => {
        current += data.length
        updateStatus(`${filesize(current)}/${filesize(total)}`)
      })
    }

    fs.mkdirpSync(this.updateDir)
    let dirs = this._dirs(require('tmp').dirSync({ dir: this.updateDir }).name)

    let dir = path.join(this.config.dataDir, 'client', manifest.version)
    let tmp = dirs.extract

    await this.extract(stream, tmp, manifest.sha256gz)
    let extracted = path.join(dirs.extract, base)

    this._cleanup()

    if (await deps.util.exists(dir)) {
      this._rename(dir, dirs.client)
    }
    this._rename(extracted, dir)

    this._cleanupDirs(dirs)

    this._createBin(path.join(dir, 'bin', this.config.bin), manifest)
  }

  extract(stream: NodeJS.ReadableStream, dir: string, sha: string): Promise<void> {
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

      let fail = (err: Error) => {
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

      let ignore = function(_: any, header: any) {
        switch (header.type) {
          case 'directory':
          case 'file':
            return false
          case 'symlink':
            return true
          default:
            throw new Error(header.type)
        }
      }
      let extract = tar.extract(dir, { ignore })
      extract.on('error', fail)
      extract.on('finish', () => {
        extracted = true
        check()
      })

      let gunzip = zlib.createGunzip()
      gunzip.on('error', fail)

      stream.pipe(gunzip).pipe(extract)
    })
  }

  private _cleanup() {
    let dir = this.updateDir
    this._catch(() => {
      if (fs.existsSync(dir)) {
        fs.readdirSync(dir).forEach(d => {
          let dirs = this._dirs(path.join(dir, d))

          this._remove(dirs.node)

          if (mtime(dirs.dir).isBefore(deps.moment().subtract(24, 'hours'))) {
            this._cleanupDirs(dirs)
          } else {
            this._removeIfEmpty(dirs)
          }
        })
      }
    })
  }

  private _cleanupDirs(dirs: TmpDirs) {
    this._remove(dirs.client)
    this._remove(dirs.extract)
    this._removeIfEmpty(dirs)
  }

  private _removeIfEmpty(dirs: TmpDirs) {
    this._catch(() => {
      if (fs.readdirSync(dirs.dir).length === 0) {
        this._remove(dirs.dir)
      }
    })
  }

  private _dirs(dir: string) {
    let client = path.join(dir, 'client')
    let extract = path.join(dir, 'extract')
    let node = path.join(dir, 'node.exe')

    return { dir, client, extract, node }
  }

  private _rename(src: string, dst: string) {
    debug(`rename ${src} to ${dst}`)
    // moveSync tries to do a rename first then falls back to copy & delete
    // on windows the delete would error on node.exe so we explicitly rename
    let rename = this.config.windows ? fs.renameSync : fs.moveSync
    rename(src, dst)
  }

  private _remove(dir: string) {
    this._catch(() => {
      if (fs.existsSync(dir)) {
        debug(`remove ${dir}`)
        fs.removeSync(dir)
      }
    })
  }

  base(manifest: Manifest): string {
    return `${this.config.name}-v${manifest.version}-${this.config.platform}-${this.config.arch}`
  }

  get autoupdateNeeded(): boolean {
    try {
      return mtime(this.autoupdatefile).isBefore(deps.moment().subtract(5, 'hours'))
    } catch (err) {
      if (err.code !== 'ENOENT') console.error(err.stack)
      debug('autoupdate ENOENT')
      return true
    }
  }

  async autoupdate(force: boolean = false) {
    try {
      await this.checkIfUpdating()
      await this.warnIfUpdateAvailable()
      if (!force && !this.autoupdateNeeded) return

      debug('autoupdate running')
      fs.outputFileSync(this.autoupdatefile, '')

      const binPath = this.binPath
      if (!binPath) {
        debug('no binpath set')
        return
      }
      debug(`spawning autoupdate on ${binPath}`)

      let fd = fs.openSync(this.autoupdatelogfile, 'a')
      // @ts-ignore
      fs.write(
        fd,
        timestamp(`starting \`${binPath} update --autoupdate\` from ${process.argv.slice(2, 3).join(' ')}\n`),
      )

      const spawn = deps.crossSpawn
      this.spawnBinPath(spawn, binPath, ['update', '--autoupdate'], {
        detached: !this.config.windows,
        stdio: ['ignore', fd, fd],
        env: this.autoupdateEnv,
      })
        .on('error', (e: Error) => cli.warn(e, { context: 'autoupdate:' }))
        .unref()
    } catch (e) {
      cli.warn(e, { context: 'autoupdate:' })
    }
  }

  get timestampEnvVar(): string {
    // TODO: use function from cli-engine-config
    let bin = this.config.bin.replace('-', '_').toUpperCase()
    return `${bin}_TIMESTAMPS`
  }

  get skipAnalyticsEnvVar(): string {
    let bin = this.config.bin.replace('-', '_').toUpperCase()
    return `${bin}_SKIP_ANALYTICS`
  }

  get autoupdateEnv(): { [k: string]: string } {
    return Object.assign({}, process.env, {
      [this.timestampEnvVar]: '1',
      [this.skipAnalyticsEnvVar]: '1',
    })
  }

  async warnIfUpdateAvailable() {
    await this._catch(async () => {
      if (!this.config.s3) return
      let v = await this.fetchVersion(false)
      let local = this.config.version.split('.')
      let remote = v.version.split('.')
      if (parseInt(local[0]) < parseInt(remote[0]) || parseInt(local[1]) < parseInt(remote[1])) {
        cli.warn(`${this.config.name}: update available from ${this.config.version} to ${v.version}`)
      }
      if (v.message) {
        cli.warn(`${this.config.name}: ${v.message}`)
      }
    })
  }

  async checkIfUpdating() {
    if (!await this.lock.canRead()) {
      debug('update in process')
      await this.restartCLI()
    } else await this.lock.read()
  }

  async restartCLI() {
    let unread = await this.lock.read()
    await unread()

    let bin = this.binPath
    let args = process.argv.slice(2)
    if (!bin) {
      if (this.config.initPath) {
        bin = process.argv[0]
        args.unshift(this.config.initPath)
      } else {
        debug('cannot restart CLI, no binpath')
        return
      }
    }

    debug('update complete, restarting CLI')
    const env = {
      ...process.env,
      CLI_ENGINE_HIDE_UPDATED_MESSAGE: '1',
    }
    const { status } = this.spawnBinPath(deps.crossSpawn.sync, bin, args, { env, stdio: 'inherit' })
    cli.exit(status)
  }

  spawnBinPath(spawnFunc: Function, binPath: string, args: string[], options: Object) {
    debug(binPath, args)
    if (this.config.windows) {
      args = ['/c', binPath].concat(args)
      return spawnFunc(process.env.comspec || 'cmd.exe', args, options)
    } else {
      return spawnFunc(binPath, args, options)
    }
  }

  private _createBin(dst: string, manifest: Manifest) {
    let src = path.join(this.config.dataDir, 'client', 'bin', this.config.bin)
    let body
    if (this.config.windows) {
      body = `@echo off
"%~dp0\\..${manifest.version}\\heroku.cmd" %*
`
    } else {
      body = `#!/usr/bin/env bash
if [ "$DEBUG" == "*" ]; then
  echo "running ${dst}" "$@"
fi
"${dst}" "$@"
`
    }
    fs.outputFileSync(src, body, { mode: 0o777 })
  }
}
