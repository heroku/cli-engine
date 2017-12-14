import cli from 'cli-ux'
import { Config } from 'cli-engine-config'
import * as path from 'path'
import * as fs from 'fs-extra'

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
    const { fork } = require('child_process')
    return new Promise((resolve, reject) => {
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
    const cacheDir = path.join(this.config.cacheDir, 'yarn')
    args = args.concat([
      '--non-interactive',
      '--link-duplicates',
      `--preferred-cache-folder=${cacheDir}`,
      ...this.proxyArgs(),
    ])

    let options = {
      cwd: this.cwd,
      stdio: [null, null, null, 'ipc'],
      env: Object.assign({}, process.env, this.pathEnv()),
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
        return this.exec(args.concat(networkConcurrency))
      } else throw err
    }
  }

  async checkForYarnLock() {
    // add yarn lockfile if it does not exist
    if (this.cwd && !fs.existsSync(path.join(this.cwd, 'yarn.lock'))) {
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
