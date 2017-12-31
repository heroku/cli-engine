import { spawn } from 'child_process'
import { cli } from 'cli-ux'
import * as path from 'path'
import RWLockfile, { rwlockfile } from 'rwlockfile'
import _ from 'ts-lodash'

import Config from './config'
import deps from './deps'

const debug = require('debug')('cli:updater')

export interface IVersion {
  version: string
  channel: string
  message?: string
}

export interface IManifest {
  version: string
  channel: string
  sha256gz: string
}

async function mtime(f: string) {
  const { mtime } = await deps.file.stat(f)
  return deps.moment(mtime)
}

function timestamp(msg: string): string {
  return `[${deps.moment().format()}] ${msg}`
}

export class Updater {
  config: Config
  lock: RWLockfile
  http: typeof deps.HTTP

  constructor(config: Config) {
    this.config = config
    this.lock = new RWLockfile(this.autoupdatefile, { ifLocked: s => debug(s.status) })
    this.http = deps.HTTP.defaults({ headers: { 'user-agent': config.userAgent } })
  }

  get autoupdatefile(): string {
    return path.join(this.config.cacheDir, 'autoupdate')
  }
  get autoupdatelogfile(): string {
    return path.join(this.config.cacheDir, 'autoupdate.log')
  }
  get versionFile(): string {
    return path.join(this.config.cacheDir, `${this.config.channel}.version`)
  }

  private get clientRoot(): string {
    return path.join(this.config.dataDir, 'client')
  }
  private get clientBin(): string {
    let b = path.join(this.clientRoot, 'bin', this.config.bin)
    return this.config.windows ? `${b}.cmd` : b
  }

  private get binPath(): string {
    return this.config.reexecBin || this.config.bin
  }

  private get s3Host(): string | undefined {
    return this.config.s3 && this.config.s3.host
  }

  s3url(channel: string, p: string): string {
    if (!this.s3Host) throw new Error('S3 host not defined')
    return `https://${this.s3Host}/${this.config.name}/channels/${channel}/${p}`
  }

  async fetchManifest(channel: string): Promise<IManifest> {
    try {
      let { body } = await this.http.get(this.s3url(channel, `${this.config.platform}-${this.config.arch}`))
      return body
    } catch (err) {
      if (err.statusCode === 403) throw new Error(`HTTP 403: Invalid channel ${channel}`)
      throw err
    }
  }

  async fetchVersion(download: boolean): Promise<IVersion> {
    let v: IVersion | undefined
    try {
      if (!download) v = await deps.file.readJSON(this.versionFile)
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }
    if (!v) {
      debug('fetching latest %s version', this.config.channel)
      let { body } = await this.http.get(this.s3url(this.config.channel, 'version'))
      v = body
      await this._catch(() => deps.file.outputJSON(this.versionFile, v))
    }
    return v!
  }

  public async warnIfUpdateAvailable() {
    await this._catch(async () => {
      if (!this.s3Host) return
      let v = await this.fetchVersion(false)
      if (deps.util.minorVersionGreater(this.config.version, v.version)) {
        cli.warn(`${this.config.name}: update available from ${this.config.version} to ${v.version}`)
      }
      if (v.message) {
        cli.warn(`${this.config.name}: ${v.message}`)
      }
    })
  }

  public async autoupdate(force: boolean = false) {
    try {
      await this.warnIfUpdateAvailable()
      if (!force && !await this.autoupdateNeeded()) return

      debug('autoupdate running')
      await deps.file.outputFile(this.autoupdatefile, '')

      debug(`spawning autoupdate on ${this.binPath}`)

      let fd = await deps.file.open(this.autoupdatelogfile, 'a')
      deps.file.write(
        fd,
        timestamp(`starting \`${this.binPath} update --autoupdate\` from ${process.argv.slice(1, 3).join(' ')}\n`),
      )

      this.spawnBinPath(this.binPath, ['update', '--autoupdate'], {
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

  @rwlockfile('lock', 'write')
  async update(manifest: IManifest) {
    let base = this.base(manifest)

    if (!this.s3Host) throw new Error('S3 host not defined')

    let url = `https://${this.s3Host}/${this.config.name}/channels/${manifest.channel}/${base}.tar.gz`
    let { response: stream } = await this.http.stream(url)

    let output = path.join(this.clientRoot, manifest.version)

    await this._mkdirp(this.clientRoot)
    await this._remove(output)

    // TODO: use cli.action.type
    if (deps.filesize && (cli.action as any).frames) {
      // if spinner action
      let total = stream.headers['content-length']
      let current = 0
      const updateStatus = _.throttle(
        (newStatus: string) => {
          cli.action.status = newStatus
        },
        500,
        { leading: true, trailing: false },
      )
      stream.on('data', data => {
        current += data.length
        updateStatus(`${deps.filesize(current)}/${deps.filesize(total)}`)
      })
    }

    await this.extract(stream, this.clientRoot, manifest.sha256gz)
    await this._rename(path.join(this.clientRoot, base), output)

    await this._createBin(manifest)
  }

  public async tidy() {
    try {
      const { moment, file } = deps
      let root = this.clientRoot
      if (!await file.exists(root)) return
      let files = await file.ls(root)
      let promises = files.map(async f => {
        if (['client', this.config.version].includes(path.basename(f.path))) return
        let mtime = f.stat.isDirectory() ? await file.newestFileInDir(f.path) : f.stat.mtime
        if (moment(mtime).isBefore(moment().subtract(24, 'hours'))) {
          await file.remove(f.path)
        }
      })
      for (let p of promises) await p
    } catch (err) {
      cli.warn(err)
    }
  }

  private extract(stream: NodeJS.ReadableStream, dir: string, sha: string): Promise<void> {
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
        this._remove(dir).then(() => reject(err))
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

      let ignore = (_: any, header: any) => {
        switch (header.type) {
          case 'directory':
          case 'file':
            debug(header.name)
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

  private async _rename(from: string, to: string) {
    await deps.file.rename(from, to)
  }

  private async _remove(dir: string) {
    if (await deps.file.exists(dir)) {
      await deps.file.remove(dir)
    }
  }

  private async _mkdirp(dir: string) {
    await deps.file.mkdirp(dir)
  }

  private base(manifest: IManifest): string {
    return `${this.config.name}-v${manifest.version}-${this.config.platform}-${this.config.arch}`
  }

  private async autoupdateNeeded(): Promise<boolean> {
    try {
      const m = await mtime(this.autoupdatefile)
      return m.isBefore(deps.moment().subtract(5, 'hours'))
    } catch (err) {
      if (err.code !== 'ENOENT') cli.error(err.stack)
      if ((global as any).testing) return false
      debug('autoupdate ENOENT')
      return true
    }
  }

  get timestampEnvVar(): string {
    // TODO: use function from @cli-engine/config
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

  private spawnBinPath(binPath: string, args: string[], options: any) {
    debug(binPath, args)
    if (this.config.windows) {
      args = ['/c', binPath, ...args]
      return spawn(process.env.comspec || 'cmd.exe', args, options)
    } else {
      return spawn(binPath, args, options)
    }
  }

  private async _createBin(manifest: IManifest) {
    let dst = this.clientBin
    if (this.config.windows) {
      let body = `@echo off
"%~dp0\\..\\${manifest.version}\\bin\\heroku.cmd" %*
`
      await deps.file.outputFile(dst, body)
      return
    }

    let src = path.join('..', manifest.version, 'bin', 'heroku')
    await deps.file.mkdirp(path.dirname(dst))
    await deps.file.remove(dst)
    await deps.file.symlink(src, dst)
  }

  private async _catch(fn: () => {}) {
    try {
      return await Promise.resolve(fn())
    } catch (err) {
      debug(err)
    }
  }
}
