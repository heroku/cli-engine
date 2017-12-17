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

async function mtime(f: string) {
  const { mtime } = await fs.stat(f)
  return deps.moment(mtime)
}

function timestamp(msg: string): string {
  return `[${deps.moment().format()}] ${msg}`
}

export class Updater {
  config: Config
  lock: Lock

  constructor(config: Config) {
    this.config = config
    this.lock = new deps.Lock(config, `${this.autoupdatefile}.lock`)
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
    const downgrade = await this.lock.write()
    let base = this.base(manifest)
    const filesize = require('filesize')

    if (!this.config.s3.host) throw new Error('S3 host not defined')

    let url = `https://${this.config.s3.host}/${this.config.name}/channels/${manifest.channel}/${base}.tar.gz`
    let { response: stream } = await deps.HTTP.stream(url)

    let clientRoot = path.join(this.config.dataDir, 'client')
    let output = path.join(clientRoot, manifest.version)

    await this._mkdirp(clientRoot)
    await this._remove(output)

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

    await this.extract(stream, clientRoot, manifest.sha256gz)
    await this._rename(path.join(clientRoot, base), output)

    await this._createBin(path.join(output, 'bin', this.config.bin), manifest)
    await downgrade()
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

      let ignore = function(_: any, header: any) {
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
    debug(`renaming ${from} to ${to}`)
    await fs.rename(from, to)
  }

  private async _remove(dir: string) {
    if (await deps.file.exists(dir)) {
      debug(`remove ${dir}`)
      await fs.remove(dir)
    }
  }

  private async _mkdirp(dir: string) {
    debug(`mkdirp ${dir}`)
    await fs.mkdirp(dir)
  }

  base(manifest: Manifest): string {
    return `${this.config.name}-v${manifest.version}-${this.config.platform}-${this.config.arch}`
  }

  private async autoupdateNeeded(): Promise<boolean> {
    try {
      const m = await mtime(this.autoupdatefile)
      return m.isBefore(deps.moment().subtract(5, 'hours'))
    } catch (err) {
      if (err.code !== 'ENOENT') console.error(err.stack)
      debug('autoupdate ENOENT')
      return true
    }
  }

  async autoupdate(force: boolean = false) {
    try {
      await this.warnIfUpdateAvailable()
      if (!force && !await this.autoupdateNeeded()) return

      debug('autoupdate running')
      await fs.outputFile(this.autoupdatefile, '')

      const binPath = this.binPath
      if (!binPath) {
        debug('no binpath set')
        return
      }
      debug(`spawning autoupdate on ${binPath}`)

      let fd = await fs.open(this.autoupdatelogfile, 'a')
      // @ts-ignore
      fs.write(
        fd,
        timestamp(`starting \`${binPath} update --autoupdate\` from ${process.argv.slice(2, 3).join(' ')}\n`),
      )

      this.spawnBinPath(binPath, ['update', '--autoupdate'], {
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

  spawnBinPath(binPath: string, args: string[], options: Object) {
    debug(binPath, args)
    if (this.config.windows) {
      args = ['/c', binPath, ...args]
      return deps.crossSpawn(process.env.comspec || 'cmd.exe', args, options)
    } else {
      return deps.crossSpawn(binPath, args, options)
    }
  }

  private async _createBin(dst: string, manifest: Manifest) {
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
    await fs.outputFile(src, body, { mode: 0o777 })
  }
}
