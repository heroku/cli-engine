import { Config } from '@cli-engine/config'
import cli from 'cli-ux'
import * as path from 'path'
import deps from '../deps'

const debug = require('debug')('cli:yarn')

export default class Yarn {
  config: Config
  cwd: string

  constructor({ config, cwd }: { config: Config; cwd: string }) {
    this.config = config
    this.cwd = cwd
  }

  get bin(): string {
    return require.resolve('yarn/bin/yarn.js')
  }

  // https://github.com/yarnpkg/yarn/blob/master/src/constants.js#L73-L90
  pathKey(env: { [k: string]: string | undefined } = process.env): string {
    let pathKey = 'PATH'

    // windows calls its path "Path" usually, but this is not guaranteed.
    if (this.config.windows) {
      pathKey = 'Path'
      for (const key in env) {
        if (key.toLowerCase() === 'path') {
          pathKey = key
        }
      }
    }
    return pathKey
  }

  // https://github.com/yarnpkg/yarn/blob/master/src/util/execute-lifecycle-script.js#L130-L154
  pathEnv(): { [k: string]: string } {
    let pathKey = this.pathKey()
    const pathParts = (process.env[pathKey] || '').split(path.delimiter)
    pathParts.unshift(path.dirname(process.execPath))

    return {
      pathKey: pathParts.join(path.delimiter),
    }
  }

  fork(modulePath: string, args: string[] = [], options: any = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      const { fork } = require('child_process')
      let forked = fork(modulePath, args, options)
      let error = ''

      forked.stdout.setEncoding('utf8')
      forked.stdout.on('data', (data: string) => {
        if (this.config.debug) {
          cli.stdout.write(data)
        }
      })

      forked.stderr.setEncoding('utf8')
      forked.stderr.on('data', (data: string) => {
        if (this.config.debug) {
          cli.stderr.write(data)
        }

        error += data
      })

      forked.on('error', reject)
      forked.on('exit', (code: number) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`yarn ${args.join(' ')} exited with code ${code}\n${error}`))
        }
      })

      // Fix windows bug with node-gyp hanging for input forever
      if (this.config.windows) {
        forked.stdin.write('\n')
      }
    })
  }

  async exec(args: string[] = []): Promise<void> {
    if (args.length !== 0) await this.checkForYarnLock()
    if (args[0] !== 'run') {
      const cacheDir = path.join(this.config.cacheDir, 'yarn')
      args = [...args, '--non-interactive', `--preferred-cache-folder=${cacheDir}`, ...this.proxyArgs()]
      if (this.config.npmRegistry) {
        args.push(`--registry=${this.config.npmRegistry}`)
      }
    }

    let options = {
      cwd: this.cwd,
      stdio: [null, null, null, 'ipc'],
      env: { ...process.env, ...this.pathEnv() },
    }

    debug(`${this.cwd}: ${this.bin} ${args.join(' ')}`)
    try {
      await this.fork(this.bin, args, options)
      debug('done')
    } catch (err) {
      // TODO: https://github.com/yarnpkg/yarn/issues/2191
      let networkConcurrency = '--network-concurrency=1'
      if (err.message.includes('EAI_AGAIN') && !args.includes(networkConcurrency)) {
        debug('EAI_AGAIN')
        return this.exec([...args, networkConcurrency])
      } else throw err
    }
  }

  async checkForYarnLock() {
    // add yarn lockfile if it does not exist
    if (this.cwd && !await deps.file.exists(path.join(this.cwd, 'yarn.lock'))) {
      await this.exec()
    }
  }

  proxyArgs(): string[] {
    let args = []
    let http = process.env.http_proxy || process.env.HTTP_PROXY
    let https = process.env.https_proxy || process.env.HTTPS_PROXY
    if (http) args.push(`--proxy=${http}`)
    if (https) args.push(`--https-proxy=${https}`)
    return args
  }
}
